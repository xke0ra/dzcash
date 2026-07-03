import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PushService } from './push.service';
import { NotificationType, NotificationChannel } from '@prisma/client';
import { Subject } from 'rxjs';

export interface NotificationEvent {
  userId: string;
  notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    data: any;
    read: boolean;
    createdAt: Date;
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  public readonly notification$ = new Subject<NotificationEvent>();

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private pushService: PushService,
  ) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: any;
    channel?: NotificationChannel;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        data: data.data || {},
        channel: data.channel || 'BOTH',
      },
    });

    // Emit SSE event for real-time delivery
    this.notification$.next({
      userId: data.userId,
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        read: notification.read,
        createdAt: notification.createdAt,
      },
    });

    // Send email if not IN_APP only
    if (data.channel !== 'IN_APP') {
      this.sendEmail(data.userId, data.type, data.title, data.body).catch(() => {});
    }

    // Send push notification if channel is BOTH or EMAIL
    if (data.channel !== 'IN_APP') {
      this.pushService.sendToUser(data.userId, { title: data.title, body: data.body, data: data.data }).catch(() => {});
    }

    return notification;
  }

  async findMany(userId: string, query: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = { userId };
    if (query.unreadOnly) where.read = false;

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return { items, total, unreadCount, page, limit };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  // ===== Trigger methods =====

  async onOfferCompleted(userId: string, offerName: string, amount: string) {
    return this.create({
      userId,
      type: 'OFFER_COMPLETED',
      title: 'Offer Completed! 🎉',
      body: `You earned $${amount} from "${offerName}". It will be available after review.`,
      data: { offerName, amount },
    });
  }

  async onConversionConfirmed(userId: string, offerName: string, amount: string) {
    return this.create({
      userId,
      type: 'OFFER_COMPLETED',
      title: 'Reward Confirmed!',
      body: `$${amount} from "${offerName}" has been added to your available balance.`,
      data: { offerName, amount },
    });
  }

  async onWithdrawalSubmitted(userId: string, amount: string, method: string) {
    return this.create({
      userId,
      type: 'WITHDRAWAL_STATUS',
      title: 'Withdrawal Submitted',
      body: `Your $${amount} ${method} withdrawal request has been submitted and is pending review.`,
      data: { amount, method },
    });
  }

  async onWithdrawalApproved(userId: string, amount: string, method: string, userEmail: string) {
    await this.create({
      userId,
      type: 'WITHDRAWAL_STATUS',
      title: 'Withdrawal Approved ✅',
      body: `Your $${amount} ${method} withdrawal has been approved and is being processed.`,
      data: { amount, method },
    });
    this.email.sendWithdrawalApproved(userEmail, amount, method).catch(() => {});
  }

  async onWithdrawalRejected(userId: string, amount: string, reason: string, userEmail: string) {
    await this.create({
      userId,
      type: 'WITHDRAWAL_STATUS',
      title: 'Withdrawal Rejected ❌',
      body: `Your $${amount} withdrawal was rejected. Reason: ${reason}`,
      data: { amount, reason },
    });
    this.email.sendWithdrawalRejected(userEmail, amount, reason).catch(() => {});
  }

  async onFraudAlert(userId: string, trigger: string, score: number, userEmail: string) {
    await this.create({
      userId,
      type: 'FRAUD_ALERT',
      title: 'Security Alert ⚠️',
      body: `Unusual activity detected: ${trigger}. Your risk score is now ${score}%.`,
      data: { trigger, score },
      channel: 'BOTH',
    });
    this.email.sendFraudAlert(userEmail, trigger).catch(() => {});
  }

  async onReferralBonus(userId: string, amount: string, referredEmail: string) {
    return this.create({
      userId,
      type: 'REFERRAL_BONUS',
      title: 'Referral Bonus! 🎉',
      body: `You earned $${amount} from ${referredEmail}'s activity!`,
      data: { amount, referredEmail },
    });
  }

  async onAccountStatusChanged(userId: string, newStatus: string, reason?: string) {
    return this.create({
      userId,
      type: 'ACCOUNT_STATUS',
      title: 'Account Status Updated',
      body: `Your account status has been changed to ${newStatus}.${reason ? ` Reason: ${reason}` : ''}`,
      data: { status: newStatus, reason },
    });
  }

  private async sendEmail(userId: string, type: NotificationType, title: string, body: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) return;
    await this.email.sendMail({
      to: user.email,
      subject: `[DZCASH] ${title}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:32px;border-radius:16px;">
        <div style="text-align:center;font-size:24px;font-weight:800;color:#38bdf8;margin-bottom:24px;">DZCASH</div>
        <h2 style="font-size:18px;">${title}</h2>
        <p style="font-size:14px;color:#94a3b8;">${body}</p>
      </div>`,
    });
  }
}
