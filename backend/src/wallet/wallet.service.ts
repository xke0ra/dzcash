import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WithdrawDto } from './dto/withdraw.dto';
import { TransactionStatus, TransactionType, WithdrawalStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  async getBalance(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return {
      pendingBalance: wallet.pendingBalance.toNumber(),
      availableBalance: wallet.availableBalance.toNumber(),
    };
  }

  async getTransactions(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWithdrawals(userId: string) {
    return this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async creditPending(userId: string, amount: number, clickId?: string, notes?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      await tx.wallet.update({
        where: { userId },
        data: { pendingBalance: { increment: amount } },
      });

      return tx.transaction.create({
        data: {
          userId,
          type: TransactionType.OFFER_CONVERSION,
          amount,
          status: TransactionStatus.PENDING,
          clickId,
          notes,
        },
      });
    });

    if (notes) {
      this.notifications.onOfferCompleted(userId, notes, amount.toString()).catch(() => {});
    }

    return result;
  }

  async settleTransaction(transactionId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!transaction) throw new NotFoundException('Transaction not found');
      if (transaction.status !== TransactionStatus.PENDING) throw new BadRequestException('Transaction is not pending');

      await tx.wallet.update({
        where: { userId: transaction.userId },
        data: {
          pendingBalance: { decrement: transaction.amount },
          availableBalance: { increment: transaction.amount },
        },
      });

      return tx.transaction.update({
        where: { id: transactionId },
        data: { status: TransactionStatus.COMPLETED },
      });
    });

    this.notifications.onConversionConfirmed(result.userId, result.notes || 'Offer', result.amount.toString()).catch(() => {});

    return result;
  }

  async reverseTransaction(transactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.status === TransactionStatus.REVERSED || transaction.status === TransactionStatus.REJECTED) {
        throw new BadRequestException('Transaction already settled or reversed');
      }

      const statusBefore = transaction.status;

      // Mark transaction as reversed
      const updatedTx = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.REVERSED,
          notes: transaction.notes ? `${transaction.notes} (Reversed due to fraud/chargeback)` : 'Reversed due to fraud/chargeback',
        },
      });

      // Adjust wallet balances
      if (statusBefore === TransactionStatus.PENDING) {
        await tx.wallet.update({
          where: { userId: transaction.userId },
          data: {
            pendingBalance: { decrement: transaction.amount },
          },
        });
      } else if (statusBefore === TransactionStatus.COMPLETED) {
        await tx.wallet.update({
          where: { userId: transaction.userId },
          data: {
            availableBalance: { decrement: transaction.amount },
          },
        });
      }

      return updatedTx;
    });
  }

  async requestWithdrawal(userId: string, dto: WithdrawDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Get user and verify status
      const user = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.status === 'FROZEN' || user.status === 'SUSPENDED') {
        throw new BadRequestException('Account restricted from making withdrawals');
      }

      // Check risk score threshold
      if (user.riskScore > 70) {
        // We will still allow submission but auto-hold it. Note: you can handle it as warning.
      }

      // 2. Lock wallet row and check available balance
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.availableBalance.toNumber() < dto.amount) {
        throw new BadRequestException('Insufficient available balance');
      }

      // 3. Deduct available balance
      await tx.wallet.update({
        where: { userId },
        data: {
          availableBalance: { decrement: dto.amount },
        },
      });

      // 4. Create withdrawal request
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          method: dto.method,
          status: WithdrawalStatus.PENDING,
          amount: dto.amount,
          details: dto.details,
        },
      });

      // 5. Create associated transaction (pending withdrawal)
      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.WITHDRAWAL,
          amount: dto.amount,
          status: TransactionStatus.PENDING,
          withdrawalId: withdrawal.id,
          notes: `Withdrawal request via ${dto.method}`,
        },
      });

      this.notifications.onWithdrawalSubmitted(userId, dto.amount.toString(), dto.method).catch(() => {});

      return withdrawal;
    });
  }

  async approveWithdrawal(withdrawalId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
      if (!withdrawal) throw new NotFoundException('Withdrawal request not found');
      if (withdrawal.status !== WithdrawalStatus.PENDING) throw new BadRequestException('Withdrawal is not pending approval');

      const updatedWithdrawal = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: WithdrawalStatus.APPROVED, processedAt: new Date() },
      });

      await tx.transaction.updateMany({
        where: { withdrawalId },
        data: { status: TransactionStatus.COMPLETED },
      });

      return updatedWithdrawal;
    });

    const user = await this.prisma.user.findUnique({ where: { id: result.userId } });
    if (user) {
      this.notifications.onWithdrawalApproved(
        user.id, result.amount.toString(), result.method, user.email,
      ).catch(() => {});
    }

    return result;
  }

  async rejectWithdrawal(withdrawalId: string, reason?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
      if (!withdrawal) throw new NotFoundException('Withdrawal request not found');
      if (withdrawal.status !== WithdrawalStatus.PENDING) throw new BadRequestException('Withdrawal is not pending approval');

      await tx.wallet.update({
        where: { userId: withdrawal.userId },
        data: { availableBalance: { increment: withdrawal.amount } },
      });

      const updatedWithdrawal = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: WithdrawalStatus.REJECTED, processedAt: new Date() },
      });

      await tx.transaction.updateMany({
        where: { withdrawalId },
        data: { status: TransactionStatus.REJECTED, notes: 'Withdrawal rejected - funds refunded to balance' },
      });

      return updatedWithdrawal;
    });

    const user = await this.prisma.user.findUnique({ where: { id: result.userId } });
    if (user) {
      this.notifications.onWithdrawalRejected(
        user.id, result.amount.toString(), reason || 'Request did not meet requirements', user.email,
      ).catch(() => {});
    }

    return result;
  }
}
