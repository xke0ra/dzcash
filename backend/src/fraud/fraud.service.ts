import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FraudTriggerType, UserStatus } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  async calculateAndApplyRisk(userId: string, ip: string, deviceFingerprint?: string): Promise<number> {
    let score = 0;
    const triggers: { type: FraudTriggerType; score: number; details: any }[] = [];

    // 1. VPN / Proxy Check
    const isVpn = this.checkVpn(ip);
    if (isVpn) {
      score += 45;
      triggers.push({
        type: FraudTriggerType.VPN_DETECTED,
        score: 45,
        details: { ip },
      });
    }

    // 2. Device Fingerprint Clones
    if (deviceFingerprint) {
      const clonesCount = await this.prisma.user.count({
        where: {
          id: { not: userId },
          clicks: {
            some: { deviceFingerprint },
          },
        },
      });

      if (clonesCount > 1) {
        const penalty = Math.min(clonesCount * 25, 50);
        score += penalty;
        triggers.push({
          type: FraudTriggerType.DEVICE_FINGERPRINT_CLONE,
          score: penalty,
          details: { deviceFingerprint, duplicateAccountsCount: clonesCount },
        });
      }
    }

    // 3. Click Velocity Check
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentClicksCount = await this.prisma.click.count({
      where: {
        userId,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentClicksCount > 15) {
      score += 30;
      triggers.push({
        type: FraudTriggerType.HIGH_VELOCITY,
        score: 30,
        details: { clicksInLast5Min: recentClicksCount },
      });
    }

    // Log the triggers in the database
    for (const trigger of triggers) {
      await this.prisma.fraudLog.create({
        data: {
          userId,
          triggerType: trigger.type,
          score: trigger.score,
          details: trigger.details,
        },
      });
    }

    // Cap the score at 100
    const finalScore = Math.min(score, 100);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const previousScore = user?.riskScore || 0;

    // Update user's risk score and adjust status if necessary
    let statusUpdate = UserStatus.ACTIVE;
    if (finalScore >= 85) {
      statusUpdate = UserStatus.SUSPENDED;
      this.logger.warn(`User ${userId} frozen automatically. Risk score: ${finalScore}`);
    } else if (finalScore >= 70) {
      statusUpdate = UserStatus.FROZEN;
      this.logger.warn(`User ${userId} wallet frozen. Risk score: ${finalScore}`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        riskScore: finalScore,
        status: statusUpdate,
      },
    });

    if (finalScore > previousScore && triggers.length > 0) {
      const triggerNames = triggers.map(t => t.type).join(', ');
      this.notifications.onFraudAlert(userId, triggerNames, finalScore, user?.email || '').catch(() => {});
    }

    return finalScore;
  }

  async checkGeoInconsistency(userId: string, clickId: string, postbackIp: string): Promise<boolean> {
    const click = await this.prisma.click.findUnique({
      where: { id: clickId },
    });

    if (!click) return false;

    // Simple mock comparison: if click IP and postback IP are different, we check if they look like different countries
    // For local testing: if click IP starts with 192.168 and postback IP starts with 10.0, we flag.
    const isDifferentSubnet = click.ip.split('.')[0] !== postbackIp.split('.')[0];
    if (isDifferentSubnet && click.ip !== '::1' && postbackIp !== '::1' && click.ip !== '127.0.0.1' && postbackIp !== '127.0.0.1') {
      const penalty = 40;
      await this.prisma.fraudLog.create({
        data: {
          userId,
          clickId,
          triggerType: FraudTriggerType.GEO_INCONSISTENCY,
          score: penalty,
          details: { clickIp: click.ip, postbackIp },
        },
      });

      // Update user's score
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const newScore = Math.min(user.riskScore + penalty, 100);
        let statusUpdate = user.status;
        if (newScore >= 85) {
          statusUpdate = UserStatus.SUSPENDED;
        } else if (newScore >= 70) {
          statusUpdate = UserStatus.FROZEN;
        }

        await this.prisma.user.update({
          where: { id: userId },
          data: { riskScore: newScore, status: statusUpdate },
        });

        this.notifications.onFraudAlert(userId, 'GEO_INCONSISTENCY', newScore, user.email).catch(() => {});
      }

      return true;
    }

    return false;
  }

  private checkVpn(ip: string): boolean {
    if (process.env.VPN_API_MOCK === 'true') {
      // Flag specific mock IPs as VPNs for testing purposes
      if (ip === '127.0.0.9' || ip.includes('vpn') || ip.includes('proxy') || ip === '8.8.8.8') {
        return true;
      }
      return false;
    }
    return false;
  }
}
