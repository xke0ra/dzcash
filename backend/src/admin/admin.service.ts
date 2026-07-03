import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { OfferSyncService } from '../offers/offer-sync.service';
import { UserStatus, UserRole, Prisma } from '@prisma/client';
import { PaginationQueryDto } from './dto/admin.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
    private notifications: NotificationService,
    private offerSyncService: OfferSyncService,
  ) {}

  async getDashboardStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalUsers, newUsersToday, activeUsers, totalOffers, totalClicks, convertedClicks, pendingWithdrawalsCount, fraudAlertsToday, earningsAgg, withdrawalAgg] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE, deletedAt: null } }),
      this.prisma.offer.count({ where: { status: true } }),
      this.prisma.click.count(),
      this.prisma.click.count({ where: { status: 'CONVERTED' } }),
      this.prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      this.prisma.fraudLog.count({ where: { createdAt: { gte: last24h } } }),
      this.prisma.transaction.aggregate({
        where: { type: 'OFFER_CONVERSION', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'WITHDRAWAL', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);

    const totalEarned = earningsAgg._sum.amount?.toNumber() || 0;
    const totalWithdrawn = withdrawalAgg._sum.amount?.toNumber() || 0;

    return {
      totalUsers,
      newUsersToday,
      activeUsers,
      totalOffers,
      totalClicks,
      convertedClicks,
      conversionRate: totalClicks > 0 ? ((convertedClicks / totalClicks) * 100).toFixed(2) : '0.00',
      pendingWithdrawalsCount,
      fraudAlertsToday,
      totalEarned,
      totalWithdrawn,
      revenue: totalEarned - totalWithdrawn,
    };
  }

  async getUsers(query: PaginationQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 25, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (query.search) {
      where.email = { contains: query.search, mode: 'insensitive' };
    }
    if (query.status) {
      where.status = query.status as UserStatus;
    }
    if (query.minRisk !== undefined || query.maxRisk !== undefined) {
      where.riskScore = {};
      if (query.minRisk !== undefined) where.riskScore.gte = query.minRisk;
      if (query.maxRisk !== undefined) where.riskScore.lte = query.maxRisk;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          status: true,
          role: true,
          riskScore: true,
          referralCode: true,
          createdAt: true,
          wallet: {
            select: { pendingBalance: true, availableBalance: true },
          },
          _count: {
            select: {
              clicks: true,
              transactions: true,
              fraudLogs: true,
              referrals: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        status: true,
        role: true,
        riskScore: true,
        referralCode: true,
        createdAt: true,
        updatedAt: true,
        wallet: true,
        _count: {
          select: {
            clicks: true,
            transactions: true,
            withdrawals: true,
            fraudLogs: true,
            referrals: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUserStatus(id: string, status: UserStatus, reason?: string, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const oldStatus = user.status;
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, status: true, role: true, riskScore: true, updatedAt: true },
    });

    await this.logAudit(adminId || id, 'USER_STATUS_CHANGED', 'User', id, oldStatus, status, `Status changed: ${oldStatus} -> ${status}${reason ? `. Reason: ${reason}` : ''}`);

    this.notifications.onAccountStatusChanged(id, status, reason).catch(() => {});

    this.logger.warn(`User ${id} status changed: ${oldStatus} -> ${status}${reason ? ` (${reason})` : ''}`);
    return updated;
  }

  async updateUserRole(id: string, role: UserRole, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const oldRole = user.role;
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, role: true, updatedAt: true },
    });

    await this.logAudit(adminId || id, 'USER_ROLE_CHANGED', 'User', id, oldRole, role, `Role changed: ${oldRole} -> ${role}`);
    return updated;
  }

  async overrideRiskScore(id: string, score: number, reason?: string, adminId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const capped = Math.min(Math.max(score, 0), 100);
    const oldScore = user.riskScore;
    let statusUpdate = user.status;
    if (capped >= 85) statusUpdate = UserStatus.SUSPENDED;
    else if (capped >= 70) statusUpdate = UserStatus.FROZEN;
    else statusUpdate = UserStatus.ACTIVE;

    const updated = await this.prisma.user.update({
      where: { id },
      data: { riskScore: capped, status: statusUpdate },
      select: { id: true, email: true, status: true, riskScore: true, updatedAt: true },
    });

    await this.logAudit(adminId || id, 'RISK_SCORE_OVERRIDDEN', 'User', id, String(oldScore), String(capped), reason || 'Manual override');
    return updated;
  }

  async getWithdrawals(query: PaginationQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 25, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.WithdrawalWhereInput = {};
    if (query.status) {
      where.status = query.status as any;
    }

    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        skip,
        take: limit,
        orderBy: query.status === 'PENDING' ? { createdAt: 'asc' } : { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, status: true, riskScore: true } },
          transaction: { select: { id: true, status: true } },
        },
      }),
      this.prisma.withdrawal.count({ where }),
    ]);

    return { withdrawals, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async approveWithdrawal(id: string, adminId?: string) {
    const result = await this.walletService.approveWithdrawal(id);
    await this.logAudit(adminId || 'system', 'WITHDRAWAL_APPROVED', 'Withdrawal', id, 'PENDING', 'APPROVED', `Withdrawal ${id} approved`);
    return result;
  }

  async rejectWithdrawal(id: string, reason: string, adminId?: string) {
    const result = await this.walletService.rejectWithdrawal(id);
    await this.logAudit(adminId || 'system', 'WITHDRAWAL_REJECTED', 'Withdrawal', id, 'PENDING', 'REJECTED', `Withdrawal ${id} rejected. Reason: ${reason}`);
    return result;
  }

  async getOffers(query: PaginationQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 25, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.OfferWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { provider: query.search as any },
      ];
    }
    if (query.status === 'active') where.status = true;
    else if (query.status === 'inactive') where.status = false;

    const [offers, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true, icon: true } },
          _count: { select: { clicks: true } },
        },
      }),
      this.prisma.offer.count({ where }),
    ]);

    return { offers, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createOffer(data: {
    provider: string;
    providerId: string;
    name: string;
    description: string;
    payoutAmount: number;
    rewardAmount: number;
    targetUrl: string;
    status?: boolean;
    categoryId?: string;
    imageUrl?: string;
    countries?: string[];
    devices?: string[];
    requirements?: string;
    instructions?: string;
  }) {
    if (data.payoutAmount <= data.rewardAmount) {
      throw new BadRequestException('payoutAmount must be greater than rewardAmount');
    }
    return this.prisma.offer.create({ data: data as any });
  }

  async updateOffer(id: string, data: Partial<{
    name: string;
    description: string;
    payoutAmount: number;
    rewardAmount: number;
    targetUrl: string;
    status: boolean;
    provider: string;
    providerId: string;
    categoryId: string;
    imageUrl: string;
    countries: string[];
    devices: string[];
    requirements: string;
    instructions: string;
  }>) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');

    if (data.payoutAmount !== undefined && data.rewardAmount !== undefined && data.payoutAmount <= data.rewardAmount) {
      throw new BadRequestException('payoutAmount must be greater than rewardAmount');
    }
    return this.prisma.offer.update({ where: { id }, data: data as any });
  }

  async toggleOfferStatus(id: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    return this.prisma.offer.update({
      where: { id },
      data: { status: !offer.status },
    });
  }

  async getFraudLogs(query: PaginationQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 25, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.FraudLogWhereInput = {};
    if (query.status === 'open') where.resolved = false;
    else if (query.status === 'resolved') where.resolved = true;

    const [logs, total] = await Promise.all([
      this.prisma.fraudLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, status: true, riskScore: true } },
        },
      }),
      this.prisma.fraudLog.count({ where }),
    ]);

    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getFraudLogsByUser(userId: string) {
    return this.prisma.fraudLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getAuditLogs(query: PaginationQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 25, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.search) {
      where.action = { contains: query.search, mode: 'insensitive' };
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private async logAudit(
    userId: string,
    action: string,
    entityType: string,
    entityId?: string,
    oldValue?: string,
    newValue?: string,
    metadata?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType,
          entityId,
          oldValue: oldValue ? String(oldValue) : undefined,
          newValue: newValue ? String(newValue) : undefined,
          metadata: metadata ? { description: metadata } : undefined,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to log audit: ${error.message}`);
    }
  }

  // === Categories ===

  async getCategories() {
    return this.prisma.offerCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { offers: true } } },
    });
  }

  async createCategory(data: { name: string; slug: string; icon?: string; sortOrder?: number }) {
    return this.prisma.offerCategory.create({ data });
  }

  async updateCategory(id: string, data: Partial<{ name: string; slug: string; icon: string; sortOrder: number }>) {
    const cat = await this.prisma.offerCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return this.prisma.offerCategory.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    const cat = await this.prisma.offerCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    await this.prisma.offer.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    return this.prisma.offerCategory.delete({ where: { id } });
  }

  // === Offer Sync ===

  async syncAllOffers() {
    return this.offerSyncService.syncAll();
  }

  async getSyncStatus() {
    return this.offerSyncService.getSyncStatus();
  }
}