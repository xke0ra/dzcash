import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as webPush from 'web-push';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private initialized = false;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const publicKey = this.config.get('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get('VAPID_PRIVATE_KEY');

    if (publicKey && privateKey) {
      webPush.setVapidDetails(
        this.config.get('VAPID_CONTACT', 'mailto:support@dzcash.com'),
        publicKey,
        privateKey,
      );
      this.initialized = true;
    } else {
      this.logger.warn('VAPID keys not configured. Push notifications disabled.');
    }
  }

  async subscribe(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      return this.prisma.pushSubscription.update({
        where: { id: existing.id },
        data: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent },
      });
    }

    return this.prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
    });
  }

  async unsubscribe(userId: string, endpoint?: string) {
    if (endpoint) {
      await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    } else {
      await this.prisma.pushSubscription.deleteMany({ where: { userId } });
    }
  }

  async sendToUser(userId: string, payload: { title: string; body: string; data?: any }) {
    if (!this.initialized) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    const result = { sent: 0, failed: 0 };
    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
        result.sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired or invalid, remove it
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
        result.failed++;
      }
    }

    if (result.sent > 0 || result.failed > 0) {
      this.logger.debug(`Push to user ${userId}: ${result.sent} sent, ${result.failed} failed`);
    }
  }

  async getSubscriptions(userId: string) {
    return this.prisma.pushSubscription.findMany({ where: { userId } });
  }
}
