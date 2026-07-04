import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FraudTriggerType, UserStatus } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { FraudAnalyticsService } from './fraud-analytics.service';

interface RuleConfig {
  id: string;
  weight: number;
  threshold?: number;
  enabled: boolean;
  cooldownSec?: number;
}

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);
  private rulesCache: Map<FraudTriggerType, RuleConfig> | null = null;
  private lastRuleRefresh = 0;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    private analytics: FraudAnalyticsService,
  ) {}

  private async getRules(): Promise<Map<FraudTriggerType, RuleConfig>> {
    const now = Date.now();
    if (this.rulesCache && now - this.lastRuleRefresh < 60000) {
      return this.rulesCache;
    }
    const rules = await this.prisma.fraudRule.findMany();
    this.rulesCache = new Map(rules.map((r) => [r.triggerType, {
      id: r.id,
      weight: r.weight,
      threshold: r.threshold ?? undefined,
      enabled: r.enabled,
      cooldownSec: r.cooldownSec ?? undefined,
    }]));
    this.lastRuleRefresh = now;
    return this.rulesCache;
  }

  async seedDefaultRules() {
    const count = await this.prisma.fraudRule.count();
    if (count > 0) return;

    const defaults = [
      { name: 'VPN / Proxy Detection', description: 'Detects VPN, proxy, or Tor usage via IPQualityScore', triggerType: FraudTriggerType.VPN_DETECTED, weight: 45, cooldownSec: 3600 },
      { name: 'Device Fingerprint Clone', description: 'Flags accounts sharing the same device fingerprint', triggerType: FraudTriggerType.DEVICE_FINGERPRINT_CLONE, weight: 25, threshold: 2, cooldownSec: 86400 },
      { name: 'Click Velocity', description: 'Excessive clicks within a short time window', triggerType: FraudTriggerType.HIGH_VELOCITY, weight: 30, threshold: 15, cooldownSec: 300 },
      { name: 'Geo Inconsistency', description: 'Click IP and postback IP originate from different countries', triggerType: FraudTriggerType.GEO_INCONSISTENCY, weight: 40, cooldownSec: 3600 },
      { name: 'IP Mismatch', description: 'User IP at registration differs from click IP', triggerType: FraudTriggerType.IP_MISMATCH, weight: 20, cooldownSec: 86400 },
      { name: 'Email Reputation', description: 'Flags disposable or high-risk email domains', triggerType: FraudTriggerType.EMAIL_REPUTATION, weight: 25, cooldownSec: 86400 },
      { name: 'Time Anomaly', description: 'Unusual time-of-day activity pattern', triggerType: FraudTriggerType.TIME_ANOMALY, weight: 15, cooldownSec: 3600 },
      { name: 'Circular Referral', description: 'Detects referral loops between users', triggerType: FraudTriggerType.CIRCULAR_REFERRAL, weight: 50, cooldownSec: 86400 },
      { name: 'Withdrawal Velocity', description: 'Multiple withdrawal requests in short time', triggerType: FraudTriggerType.WITHDRAWAL_VELOCITY, weight: 20, threshold: 3, cooldownSec: 3600 },
      { name: 'Multiple Accounts', description: 'Same IP used across multiple accounts', triggerType: FraudTriggerType.MULTIPLE_ACCOUNTS, weight: 35, threshold: 3, cooldownSec: 86400 },
      { name: 'Abnormal Pattern', description: 'Unusual behavioral pattern detected via statistical analysis', triggerType: FraudTriggerType.ABNORMAL_PATTERN, weight: 30, cooldownSec: 3600 },
    ];

    for (const rule of defaults) {
      await this.prisma.fraudRule.create({ data: rule });
    }
    this.logger.log('Seeded 11 default fraud detection rules');
  }

  private async getGeoCountry(ip: string): Promise<string | null> {
    const apiKey = process.env.IPQS_API_KEY;
    if (!apiKey) return null;
    try {
      const url = `https://ipqualityscore.com/api/json/ip/${apiKey}/${encodeURIComponent(ip)}?strictness=1&fast=true`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const data = await res.json() as any;
      return data.country_code || null;
    } catch {
      return null;
    }
  }

  private disposableDomains = new Set([
    'tempmail.com', 'throwaway.com', 'mailinator.com', 'guerrillamail.com',
    'sharklasers.com', 'yopmail.com', '10minutemail.com', 'temp-mail.org',
    'mailnator.com', 'maildrop.cc', 'getnada.com', 'trashmail.com',
    'dispostable.com', 'mailnesia.com', 'spambox.us',
  ]);

  async calculateAndApplyRisk(
    userId: string,
    ip: string,
    deviceFingerprint?: string,
  ): Promise<number> {
    await this.seedDefaultRules();
    const rules = await this.getRules();

    let score = 0;
    const triggers: { type: FraudTriggerType; score: number; details: any; ruleId: string }[] = [];

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, ipAddress: true, riskScore: true },
    });

    // 1. VPN / Proxy Check
    const vpnRule = rules.get(FraudTriggerType.VPN_DETECTED);
    if (vpnRule?.enabled && ip !== '127.0.0.1' && ip !== '::1') {
      const vpnResult = await this.checkVpn(ip);
      if (vpnResult.isVpn) {
        triggers.push({
          type: FraudTriggerType.VPN_DETECTED, score: vpnRule.weight, ruleId: vpnRule.id,
          details: { ip, riskScore: vpnResult.riskScore, isProxy: vpnResult.isProxy, country: vpnResult.country },
        });
      }
    }

    // 2. Device Fingerprint Clones
    const cloneRule = rules.get(FraudTriggerType.DEVICE_FINGERPRINT_CLONE);
    if (cloneRule?.enabled && deviceFingerprint) {
      const clonesCount = await this.prisma.user.count({
        where: { id: { not: userId }, clicks: { some: { deviceFingerprint } } },
      });
      const threshold = cloneRule.threshold ?? 2;
      if (clonesCount >= threshold) {
        triggers.push({
          type: FraudTriggerType.DEVICE_FINGERPRINT_CLONE, score: Math.min(clonesCount * cloneRule.weight, 50), ruleId: cloneRule.id,
          details: { deviceFingerprint, duplicateAccountsCount: clonesCount },
        });
      }
    }

    // 3. Click Velocity with adaptive threshold
    const velocityRule = rules.get(FraudTriggerType.HIGH_VELOCITY);
    if (velocityRule?.enabled) {
      const windowMs = (velocityRule.cooldownSec ?? 300) * 1000;
      const since = new Date(Date.now() - windowMs);
      const recentClicksCount = await this.prisma.click.count({
        where: { userId, createdAt: { gte: since } },
      });
      const baseline = await this.prisma.userBehaviorBaseline.findUnique({ where: { userId } });
      let threshold = velocityRule.threshold ?? 15;
      if (baseline && baseline.stdClicksPerHour > 0) {
        const adaptiveThreshold = Math.round(baseline.avgClicksPerHour + 3 * baseline.stdClicksPerHour);
        threshold = Math.max(threshold, adaptiveThreshold);
      }
      if (recentClicksCount > threshold) {
        triggers.push({
          type: FraudTriggerType.HIGH_VELOCITY, score: velocityRule.weight, ruleId: velocityRule.id,
          details: { clicksInLastWindow: recentClicksCount, windowSec: windowMs / 1000, threshold },
        });
      }
    }

    // 4. IP Mismatch
    const ipMismatchRule = rules.get(FraudTriggerType.IP_MISMATCH);
    if (ipMismatchRule?.enabled && user?.ipAddress && user.ipAddress !== ip && user.ipAddress !== '127.0.0.1' && ip !== '127.0.0.1') {
      triggers.push({
        type: FraudTriggerType.IP_MISMATCH, score: ipMismatchRule.weight, ruleId: ipMismatchRule.id,
        details: { regIp: user.ipAddress, currentIp: ip },
      });
    }

    // 5. Multiple accounts from same IP
    const multiAccRule = rules.get(FraudTriggerType.MULTIPLE_ACCOUNTS);
    if (multiAccRule?.enabled) {
      const threshold = multiAccRule.threshold ?? 3;
      const accountsOnIp = await this.prisma.user.count({
        where: { ipAddress: ip, id: { not: userId }, deletedAt: null },
      });
      if (accountsOnIp >= threshold) {
        triggers.push({
          type: FraudTriggerType.MULTIPLE_ACCOUNTS, score: Math.min(accountsOnIp * multiAccRule.weight, 70), ruleId: multiAccRule.id,
          details: { ip, accountsCount: accountsOnIp },
        });
      }
    }

    // 6. Time Anomaly
    const timeRule = rules.get(FraudTriggerType.TIME_ANOMALY);
    if (timeRule?.enabled) {
      const hour = new Date().getHours();
      const baseline = await this.prisma.userBehaviorBaseline.findUnique({ where: { userId } });
      const isOffPeak = baseline
        ? hour < baseline.peakActivityStart || hour > baseline.peakActivityEnd
        : (hour >= 2 && hour <= 5);
      if (isOffPeak) {
        const recentClicks = await this.prisma.click.count({
          where: { userId, createdAt: { gte: new Date(Date.now() - 86400000) } },
        });
        if (recentClicks > 3) {
          triggers.push({
            type: FraudTriggerType.TIME_ANOMALY, score: timeRule.weight, ruleId: timeRule.id,
            details: { hour, clicksLast24h: recentClicks, peakStart: baseline?.peakActivityStart, peakEnd: baseline?.peakActivityEnd },
          });
        }
      }
    }

    // 7. Email Reputation
    const emailRule = rules.get(FraudTriggerType.EMAIL_REPUTATION);
    if (emailRule?.enabled && user?.email) {
      const domain = user.email.split('@')[1]?.toLowerCase();
      if (domain && this.disposableDomains.has(domain)) {
        triggers.push({
          type: FraudTriggerType.EMAIL_REPUTATION, score: emailRule.weight, ruleId: emailRule.id,
          details: { email: user.email, domain },
        });
      }
    }

    // 8. Statistical anomaly detection (adaptive)
    const anomalyRule = rules.get(FraudTriggerType.ABNORMAL_PATTERN);
    if (anomalyRule?.enabled) {
      const anomalyScore = await this.analytics.checkAnomalyScore(userId);
      if (anomalyScore >= 15) {
        triggers.push({
          type: FraudTriggerType.ABNORMAL_PATTERN, score: Math.min(anomalyRule.weight, anomalyScore), ruleId: anomalyRule.id,
          details: { anomalyScore, reason: anomalyScore >= 25 ? 'Statistical outlier in click velocity' : 'Unusual activity time' },
        });
      }
    }

    // Apply weighted scoring
    for (const trigger of triggers) {
      score += trigger.score;
    }

    // Log all triggers with cooldown check
    for (const trigger of triggers) {
      const rule = rules.get(trigger.type);
      if (rule?.cooldownSec) {
        const recent = await this.prisma.fraudLog.findFirst({
          where: { userId, triggerType: trigger.type, createdAt: { gte: new Date(Date.now() - rule.cooldownSec * 1000) } },
        });
        if (recent) continue;
      }
      await this.prisma.fraudLog.create({
        data: { userId, triggerType: trigger.type, score: trigger.score, details: trigger.details },
      });
    }

    const finalScore = Math.min(score, 100);
    const previousScore = user?.riskScore || 0;

    let statusUpdate: UserStatus = UserStatus.ACTIVE;
    if (finalScore >= 85) {
      statusUpdate = UserStatus.SUSPENDED;
      this.logger.warn(`User ${userId} suspended — risk score: ${finalScore}`);
    } else if (finalScore >= 70) {
      statusUpdate = UserStatus.FROZEN;
      this.logger.warn(`User ${userId} frozen — risk score: ${finalScore}`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { riskScore: finalScore, status: statusUpdate },
    });

    if (finalScore > previousScore && triggers.length > 0) {
      const triggerNames = triggers.map(t => t.type).join(', ');
      this.notifications.onFraudAlert(userId, triggerNames, finalScore, user?.email || '').catch(() => {});
    }

    return finalScore;
  }

  async checkGeoInconsistency(userId: string, clickId: string, postbackIp: string): Promise<boolean> {
    const rules = await this.getRules();
    const geoRule = rules.get(FraudTriggerType.GEO_INCONSISTENCY);
    if (!geoRule?.enabled) return false;

    const click = await this.prisma.click.findUnique({ where: { id: clickId } });
    if (!click || click.ip === '::1' || click.ip === '127.0.0.1' || postbackIp === '::1' || postbackIp === '127.0.0.1') return false;

    const clickCountry = await this.getGeoCountry(click.ip);
    const postbackCountry = await this.getGeoCountry(postbackIp);

    let isDifferent = false;
    const details: any = { clickIp: click.ip, postbackIp };

    if (clickCountry && postbackCountry) {
      isDifferent = clickCountry !== postbackCountry;
      details.clickCountry = clickCountry;
      details.postbackCountry = postbackCountry;
      details.matchType = 'country_code';
    } else {
      const clickOctet = click.ip.split('.')[0];
      const pbOctet = postbackIp.split('.')[0];
      isDifferent = clickOctet !== pbOctet;
      details.matchType = 'subnet_fallback';
    }

    if (isDifferent) {
      const score = geoRule.weight;
      await this.prisma.fraudLog.create({
        data: { userId, clickId, triggerType: FraudTriggerType.GEO_INCONSISTENCY, score, details },
      });
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const newScore = Math.min((user.riskScore || 0) + score, 100);
        let statusUpdate = user.status;
        if (newScore >= 85) statusUpdate = UserStatus.SUSPENDED;
        else if (newScore >= 70) statusUpdate = UserStatus.FROZEN;
        await this.prisma.user.update({ where: { id: userId }, data: { riskScore: newScore, status: statusUpdate } });
        this.notifications.onFraudAlert(userId, 'GEO_INCONSISTENCY', newScore, user.email).catch(() => {});
      }
      return true;
    }
    return false;
  }

  async checkWithdrawalFraud(userId: string, amount: number): Promise<{ flagged: boolean; reason?: string; score: number }> {
    const rules = await this.getRules();
    let score = 0;
    const reasons: string[] = [];

    const velRule = rules.get(FraudTriggerType.WITHDRAWAL_VELOCITY);
    if (velRule?.enabled) {
      const windowMs = (velRule.cooldownSec ?? 3600) * 1000;
      const recentCount = await this.prisma.withdrawal.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - windowMs) } },
      });
      const baseline = await this.prisma.userBehaviorBaseline.findUnique({ where: { userId } });
      let threshold = velRule.threshold ?? 3;
      if (baseline && baseline.stdWithdrawalAmount > 0) {
        const adaptiveMax = Math.max(1, Math.round(baseline.avgWithdrawalAmount + 2 * baseline.stdWithdrawalAmount));
        threshold = Math.max(threshold, adaptiveMax);
      }
      if (recentCount >= threshold) {
        score += velRule.weight;
        reasons.push(`High withdrawal velocity: ${recentCount} in ${windowMs / 1000}s (threshold: ${threshold})`);
      }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && user.riskScore >= 50) {
      score += Math.round(user.riskScore / 5);
      reasons.push(`User risk score: ${user.riskScore}`);
    }

    if (user) {
      const totalWithdrawn = await this.prisma.withdrawal.aggregate({
        where: { userId, status: 'COMPLETED' },
        _sum: { amount: true },
      });
      const baseline = await this.prisma.userBehaviorBaseline.findUnique({ where: { userId } });
      let avgWithdrawal = totalWithdrawn._sum.amount?.toNumber() || 0;
      if (baseline && baseline.avgWithdrawalAmount > 0) {
        avgWithdrawal = baseline.avgWithdrawalAmount;
      }
      if (amount > avgWithdrawal * 3 && avgWithdrawal > 0) {
        score += 15;
        reasons.push(`Amount anomaly: $${amount} vs avg $${avgWithdrawal.toFixed(2)}`);
      }
    }

    return { flagged: score >= 30, reason: reasons.join('; '), score };
  }

  async resolveFraudLog(logId: string, resolvedBy: string, action: 'dismiss' | 'sustain', note?: string) {
    const log = await this.prisma.fraudLog.findUnique({ where: { id: logId } });
    if (!log) return null;

    const updated = await this.prisma.fraudLog.update({
      where: { id: logId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolvedNote: note || (action === 'dismiss' ? 'Dismissed — false positive' : 'Sustained — confirmed fraud'),
      },
    });

    // Record feedback for ML weight adjustment
    const rules = await this.getRules();
    const rule = rules.get(log.triggerType as FraudTriggerType);
    if (rule) {
      await this.analytics.recordFeedback(rule.id, action === 'sustain');
    }

    if (action === 'sustain') {
      const user = await this.prisma.user.findUnique({ where: { id: log.userId } });
      if (user) {
        const newScore = Math.min((user.riskScore || 0) + log.score, 100);
        let statusUpdate = user.status;
        if (newScore >= 85) statusUpdate = UserStatus.SUSPENDED;
        else if (newScore >= 70) statusUpdate = UserStatus.FROZEN;
        await this.prisma.user.update({ where: { id: log.userId }, data: { riskScore: newScore, status: statusUpdate } });
        this.notifications.onAccountStatusChanged(log.userId, statusUpdate, `Fraud alert sustained: ${log.triggerType}`).catch(() => {});
      }
    }

    // Trigger baseline recomputation if threshold reached
    if (log.userId) {
      const fraudCount = await this.prisma.fraudLog.count({ where: { userId: log.userId } });
      if (fraudCount % 10 === 0) {
        this.analytics.computeUserBaseline(log.userId).catch(() => {});
      }
    }

    return updated;
  }

  async reverseFraudTransaction(logId: string, adminId: string) {
    const log = await this.prisma.fraudLog.findUnique({
      where: { id: logId },
      include: { user: true },
    });
    if (!log) return null;

    if (log.clickId) {
      const click = await this.prisma.click.findUnique({
        where: { id: log.clickId },
        include: { transaction: true },
      });

      if (click?.transaction && click.transaction.status !== 'REVERSED' && click.transaction.status !== 'REJECTED') {
        const txId = click.transaction.id;
        const txType = click.transaction.type;
        const txAmount = click.transaction.amount;
        await this.prisma.$transaction(async (tx) => {
          await tx.transaction.update({
            where: { id: txId },
            data: { status: 'REVERSED' },
          });
          if (txType === 'OFFER_CONVERSION') {
            await tx.wallet.update({
              where: { userId: log.userId },
              data: { pendingBalance: { decrement: txAmount } },
            });
          }
          await tx.fraudLog.update({
            where: { id: logId },
            data: { resolved: true, resolvedAt: new Date(), resolvedBy: adminId, resolvedNote: 'Transaction reversed due to fraud' },
          });
        });
        return { reversed: true, transactionId: txId };
      }
    }
    return { reversed: false, reason: 'No reversible transaction found' };
  }

  async getFraudRules() {
    return this.prisma.fraudRule.findMany({ orderBy: { name: 'asc' } });
  }

  async updateFraudRule(id: string, data: { weight?: number; enabled?: boolean; threshold?: number | null }) {
    const rule = await this.prisma.fraudRule.findUnique({ where: { id } });
    if (!rule) return null;
    return this.prisma.fraudRule.update({ where: { id }, data });
  }

  async getAnalytics() {
    return this.analytics.getDashboardStats();
  }

  async getRuleRecommendations() {
    return this.analytics.getRuleRecommendations();
  }

  async recomputeBaseline(userId: string) {
    return this.analytics.computeUserBaseline(userId);
  }

  private async checkVpn(ip: string): Promise<{ isVpn: boolean; riskScore: number; isProxy: boolean; country: string | null }> {
    const apiKey = process.env.IPQS_API_KEY;
    if (!apiKey) {
      return { isVpn: false, riskScore: 0, isProxy: false, country: null };
    }
    try {
      const url = `https://ipqualityscore.com/api/json/ip/${apiKey}/${encodeURIComponent(ip)}?strictness=1&allow_public_access_points=true&fast=true`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { isVpn: false, riskScore: 0, isProxy: false, country: null };
      const data = await res.json() as any;
      return {
        isVpn: !!data.proxy || !!data.vpn || !!data.tor,
        riskScore: data.fraud_score || 0,
        isProxy: !!data.proxy,
        country: data.country_code || null,
      };
    } catch {
      return { isVpn: false, riskScore: 0, isProxy: false, country: null };
    }
  }
}
