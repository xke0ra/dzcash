import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WithdrawDto, BulkPayoutDto, ScheduleDto } from './dto/withdraw.dto';
import { TransactionStatus, TransactionType, WithdrawalMethod, WithdrawalStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';
import { FraudService } from '../fraud/fraud.service';
import { CacheService } from '../common/cache.service';

const MIN_WITHDRAWAL = 0.01;
const AUTO_APPROVE_THRESHOLD = 5.00;

const FEE_RATES: Record<WithdrawalMethod, { percent: number; fixed: number }> = {
  PAYPAL: { percent: 2.0, fixed: 0.25 },
  CRYPTO: { percent: 0.5, fixed: 0.10 },
  GIFT_CARD: { percent: 1.0, fixed: 0.00 },
  USDT_TRC20: { percent: 0.5, fixed: 0.00 },
  GIFT_CARD_AMAZON: { percent: 1.0, fixed: 0.00 },
  GIFT_CARD_GOOGLE_PLAY: { percent: 1.0, fixed: 0.00 },
  MOBILE_MONEY: { percent: 1.5, fixed: 0.10 },
};

const METHOD_LABELS: Record<WithdrawalMethod, string> = {
  PAYPAL: 'PayPal',
  CRYPTO: 'Cryptocurrency',
  GIFT_CARD: 'Gift Card',
  USDT_TRC20: 'USDT TRC20',
  GIFT_CARD_AMAZON: 'Amazon Gift Card',
  GIFT_CARD_GOOGLE_PLAY: 'Google Play Gift Card',
  MOBILE_MONEY: 'Mobile Money',
};

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    private fraudService: FraudService,
    private cache: CacheService,
  ) {}

  async getBalance(userId: string) {
    return this.cache.wrap(this.cache.buildKey('wallet', userId), 60, async () => {
      const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');
      return {
        pendingBalance: wallet.pendingBalance.toNumber(),
        availableBalance: wallet.availableBalance.toNumber(),
      };
    });
  }

  async getTransactions(userId: string) {
    return this.cache.wrap(this.cache.buildKey('txns', userId), 60, () =>
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }

  async getWithdrawals(userId: string) {
    return this.cache.wrap(this.cache.buildKey('withdrawals', userId), 60, () =>
      this.prisma.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    );
  }

  private async invalidateUserCache(userId: string) {
    await Promise.all([
      this.cache.del(this.cache.buildKey('wallet', userId)),
      this.cache.del(this.cache.buildKey('txns', userId)),
      this.cache.del(this.cache.buildKey('withdrawals', userId)),
    ]);
  }

  async creditPending(userId: string, amount: number, clickId?: string, notes?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');
      await tx.wallet.update({ where: { userId }, data: { pendingBalance: { increment: amount } } });
      return tx.transaction.create({
        data: { userId, type: TransactionType.OFFER_CONVERSION, amount, status: TransactionStatus.PENDING, clickId, notes },
      });
    });
    if (notes) this.notifications.onOfferCompleted(userId, notes, amount.toString()).catch(() => {});
    return result;
  }

  async settleTransaction(transactionId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!transaction) throw new NotFoundException('Transaction not found');
      if (transaction.status !== TransactionStatus.PENDING) throw new BadRequestException('Transaction is not pending');
      await tx.wallet.update({
        where: { userId: transaction.userId },
        data: { pendingBalance: { decrement: transaction.amount }, availableBalance: { increment: transaction.amount } },
      });
      return tx.transaction.update({ where: { id: transactionId }, data: { status: TransactionStatus.COMPLETED } });
    });
    this.notifications.onConversionConfirmed(result.userId, result.notes || 'Offer', result.amount.toString()).catch(() => {});
    return result;
  }

  async reverseTransaction(transactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!transaction) throw new NotFoundException('Transaction not found');
      if (transaction.status === TransactionStatus.REVERSED || transaction.status === TransactionStatus.REJECTED) {
        throw new BadRequestException('Transaction already settled or reversed');
      }
      const statusBefore = transaction.status;
      const updatedTx = await tx.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.REVERSED, notes: transaction.notes ? `${transaction.notes} (Reversed due to fraud/chargeback)` : 'Reversed due to fraud/chargeback' },
      });
      if (statusBefore === TransactionStatus.PENDING) {
        await tx.wallet.update({ where: { userId: transaction.userId }, data: { pendingBalance: { decrement: transaction.amount } } });
      } else if (statusBefore === TransactionStatus.COMPLETED) {
        await tx.wallet.update({ where: { userId: transaction.userId }, data: { availableBalance: { decrement: transaction.amount } } });
      }
      return updatedTx;
    });
  }

  calculateFee(method: WithdrawalMethod, amount: number, level: number = 1): { fee: number; netAmount: number } {
    const rate = FEE_RATES[method] || { percent: 2.0, fixed: 0.25 };
    const levelDiscount = Math.min(level * 0.5, 50); // up to 50% fee discount at level 100
    const adjustedPercent = rate.percent * (1 - levelDiscount / 100);
    const fee = Math.max(amount * (adjustedPercent / 100) + rate.fixed, 0.01);
    const netAmount = Math.max(amount - fee, 0);
    return { fee: Math.round(fee * 100) / 100, netAmount: Math.round(netAmount * 100) / 100 };
  }

  async getFeeEstimate(userId: string, method: WithdrawalMethod, amount: number) {
    const xp = await this.cache.wrap(this.cache.buildKey('xp', userId), 300, () =>
      this.prisma.userXp.findUnique({ where: { userId } }),
    );
    const level = xp?.level || 1;
    return this.calculateFee(method, amount, level);
  }

  async getMethods() {
    const methods = Object.values(WithdrawalMethod);
    return methods.map((m) => ({
      method: m,
      label: METHOD_LABELS[m],
      fee: FEE_RATES[m],
      minAmount: MIN_WITHDRAWAL,
    }));
  }

  async requestWithdrawal(userId: string, dto: WithdrawDto) {
    if (dto.amount < MIN_WITHDRAWAL) {
      throw new BadRequestException(`Minimum withdrawal amount is $${MIN_WITHDRAWAL.toFixed(2)}`);
    }

    // Fraud check on withdrawal
    const fraudCheck = await this.fraudService.checkWithdrawalFraud(userId, dto.amount);
    if (fraudCheck.flagged) {
      this.logger.warn(`Withdrawal flagged for user ${userId}: ${fraudCheck.reason}`);
    }

    const xp = await this.prisma.userXp.findUnique({ where: { userId } });
    const level = xp?.level || 1;
    const { fee, netAmount } = this.calculateFee(dto.method, dto.amount, level);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      if (user.status === 'FROZEN' || user.status === 'SUSPENDED') {
        throw new BadRequestException('Account restricted from making withdrawals');
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');
      if (wallet.availableBalance.toNumber() < dto.amount) {
        throw new BadRequestException('Insufficient available balance');
      }

      // Determine if auto-approve (small amounts for low-risk users)
      const autoApprove = dto.amount <= AUTO_APPROVE_THRESHOLD && user.riskScore <= 40;
      const status = autoApprove ? WithdrawalStatus.PROCESSING : WithdrawalStatus.PENDING;

      await tx.wallet.update({ where: { userId }, data: { availableBalance: { decrement: dto.amount } } });

      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          method: dto.method,
          status,
          amount: dto.amount,
          fee,
          netAmount,
          details: dto.details,
          autoApproved: autoApprove,
          processedAt: autoApprove ? new Date() : null,
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.WITHDRAWAL,
          amount: dto.amount,
          status: TransactionStatus.PENDING,
          withdrawalId: withdrawal.id,
          notes: `Withdrawal via ${METHOD_LABELS[dto.method]}${autoApprove ? ' (auto-approved)' : ''}`,
        },
      });

      this.notifications.onWithdrawalSubmitted(userId, dto.amount.toString(), dto.method).catch(() => {});

      if (autoApprove) {
        // For auto-approved withdrawals, mark transaction completed
        await tx.transaction.updateMany({
          where: { withdrawalId: withdrawal.id },
          data: { status: TransactionStatus.COMPLETED },
        });
        this.logger.log(`Auto-approved withdrawal ${withdrawal.id} for $${dto.amount}`);
      }

      return { ...withdrawal, autoApproved: autoApprove, fee, netAmount };
    });
  }

  async approveWithdrawal(withdrawalId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
      if (!withdrawal) throw new NotFoundException('Withdrawal request not found');
      if (withdrawal.status !== WithdrawalStatus.PENDING) throw new BadRequestException('Withdrawal is not pending approval');

      const updated = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: WithdrawalStatus.APPROVED, processedAt: new Date() },
      });
      await tx.transaction.updateMany({ where: { withdrawalId }, data: { status: TransactionStatus.COMPLETED } });
      return updated;
    });

    const user = await this.prisma.user.findUnique({ where: { id: result.userId } });
    if (user) {
      this.notifications.onWithdrawalApproved(user.id, result.amount.toString(), result.method, user.email).catch(() => {});
    }
    return result;
  }

  async rejectWithdrawal(withdrawalId: string, reason?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
      if (!withdrawal) throw new NotFoundException('Withdrawal request not found');
      if (withdrawal.status !== WithdrawalStatus.PENDING) throw new BadRequestException('Withdrawal is not pending approval');

      await tx.wallet.update({ where: { userId: withdrawal.userId }, data: { availableBalance: { increment: withdrawal.amount } } });

      const updated = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: WithdrawalStatus.REJECTED, processedAt: new Date() },
      });
      await tx.transaction.updateMany({
        where: { withdrawalId },
        data: { status: TransactionStatus.REJECTED, notes: 'Withdrawal rejected - funds refunded' },
      });
      return updated;
    });

    const user = await this.prisma.user.findUnique({ where: { id: result.userId } });
    if (user) {
      this.notifications.onWithdrawalRejected(user.id, result.amount.toString(), reason || 'Request did not meet requirements', user.email).catch(() => {});
    }
    return result;
  }

  async bulkApprove(dto: BulkPayoutDto) {
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (const id of dto.withdrawalIds) {
      try {
        await this.approveWithdrawal(id);
        results.push({ id, success: true });
      } catch (err: any) {
        results.push({ id, success: false, error: err.message });
      }
    }
    return { results, total: results.length, approved: results.filter((r) => r.success).length };
  }

  async getSchedule(userId: string) {
    return this.prisma.withdrawalSchedule.findUnique({ where: { userId } });
  }

  async updateSchedule(userId: string, dto: ScheduleDto) {
    return this.prisma.withdrawalSchedule.upsert({
      where: { userId },
      update: { method: dto.method, details: dto.details, threshold: dto.threshold, enabled: dto.enabled ?? true },
      create: { userId, method: dto.method, details: dto.details, threshold: dto.threshold, enabled: dto.enabled ?? true },
    });
  }

  async deleteSchedule(userId: string) {
    await this.prisma.withdrawalSchedule.deleteMany({ where: { userId } });
    return { message: 'Schedule removed' };
  }

  async processScheduledWithdrawals() {
    const schedules = await this.prisma.withdrawalSchedule.findMany({
      where: { enabled: true },
      include: { user: { include: { wallet: true } } },
    });

    let processed = 0;
    for (const sched of schedules) {
      const balance = sched.user.wallet?.availableBalance.toNumber() || 0;
      if (balance >= sched.threshold.toNumber()) {
        try {
          await this.requestWithdrawal(sched.userId, {
            method: sched.method,
            amount: balance,
            details: sched.details as Record<string, any>,
          });
          processed++;
          this.logger.log(`Scheduled withdrawal for user ${sched.userId}: $${balance}`);
        } catch (err: any) {
          this.logger.warn(`Scheduled withdrawal failed for ${sched.userId}: ${err.message}`);
        }
      }
    }
    return { processed, total: schedules.length };
  }
}
