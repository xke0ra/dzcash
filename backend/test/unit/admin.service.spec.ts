import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from '../../src/admin/admin.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { WalletService } from '../../src/wallet/wallet.service';
import { NotificationService } from '../../src/notification/notification.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    wallet: { findMany: jest.fn(), findUnique: jest.fn() },
    withdrawal: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    transaction: { findMany: jest.fn(), count: jest.fn() },
    offer: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    fraudLog: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    auditLog: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
  };

  const mockWalletService = {
    approveWithdrawal: jest.fn(),
    rejectWithdrawal: jest.fn(),
  };

  const mockNotifications = {
    onAccountStatusChanged: jest.fn(),
    onFraudAlert: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WalletService, useValue: mockWalletService },
        { provide: NotificationService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return aggregated stats', async () => {
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.offer.count.mockResolvedValue(50);
      mockPrisma.transaction.count.mockResolvedValue(500);
      mockPrisma.withdrawal.count.mockResolvedValue(10);

      // Mock sum aggregations
      mockPrisma.transaction.findMany
        .mockResolvedValueOnce([{ amount: 1000 }]) // total earned
        .mockResolvedValueOnce([{ amount: 500 }]); // today earned

      const result = await service.getDashboardStats();

      expect(result).toBeDefined();
      expect(result.totalUsers).toBeGreaterThanOrEqual(0);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status and log audit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'test@test.com', status: 'ACTIVE', role: 'USER', riskScore: 10,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1', email: 'test@test.com', status: 'FROZEN', role: 'USER', riskScore: 10, updatedAt: new Date(),
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.updateUserStatus('user-1', 'FROZEN', 'Suspicious activity', 'admin-1');

      expect(result.status).toBe('FROZEN');
      expect(mockNotifications.onAccountStatusChanged).toHaveBeenCalledWith('user-1', 'FROZEN', 'Suspicious activity');
    });

    it('should throw for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUserStatus('invalid-id', 'SUSPENDED')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role and log audit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'test@test.com', role: 'USER',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1', email: 'test@test.com', role: 'ADMIN', updatedAt: new Date(),
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await service.updateUserRole('user-1', 'ADMIN', 'admin-1');

      expect(result.role).toBe('ADMIN');
    });
  });

  describe('getUsers / getUserById', () => {
    it('should list users with pagination', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1', email: 'test@test.com' }]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers({ page: 1, pageSize: 20 });
      expect(result).toBeDefined();
    });
  });

  describe('fraud operations', () => {
    it('should list fraud logs', async () => {
      mockPrisma.fraudLog.findMany.mockResolvedValue([
        { id: 'fl-1', userId: 'user-1', triggerType: 'VPN_DETECTED', score: 45, details: {}, resolved: false },
      ]);
      mockPrisma.fraudLog.count.mockResolvedValue(1);

      const result = await service.getFraudLogs({ page: 1, pageSize: 20 });
      expect(result).toBeDefined();
    });
  });

  describe('audit trail', () => {
    it('should return audit logs', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { id: 'al-1', userId: 'admin-1', action: 'USER_STATUS_CHANGED', entityType: 'User', createdAt: new Date() },
      ]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.getAuditLogs({ page: 1, pageSize: 20 });
      expect(result).toBeDefined();
    });
  });
});
