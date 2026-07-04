import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from '../../src/wallet/wallet.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationService } from '../../src/notification/notification.service';

describe('WalletService', () => {
  let service: WalletService;
  let prisma: PrismaService;

  const mockTx = {
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    withdrawal: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockPrisma = {
    wallet: { findUnique: jest.fn(), update: jest.fn() },
    transaction: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    withdrawal: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockNotifications = {
    onOfferCompleted: jest.fn(),
    onConversionConfirmed: jest.fn(),
    onWithdrawalSubmitted: jest.fn(),
    onWithdrawalApproved: jest.fn(),
    onWithdrawalRejected: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return wallet balance', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        pendingBalance: { toNumber: () => 10.0 },
        availableBalance: { toNumber: () => 50.0 },
      });

      const result = await service.getBalance('user-1');

      expect(result.pendingBalance).toBe(10.0);
      expect(result.availableBalance).toBe(50.0);
    });

    it('should throw if wallet not found', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);

      await expect(service.getBalance('user-nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('creditPending', () => {
    it('should credit pending balance and create transaction', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
        mockTx.wallet.findUnique.mockResolvedValue({
          pendingBalance: { toNumber: () => 10 },
        });
        mockTx.transaction.create.mockResolvedValue({
          id: 'tx-1',
          userId: 'user-1',
          amount: 5.0,
          status: 'PENDING',
        });
        return cb(mockTx);
      });

      const result = await service.creditPending('user-1', 5.0, 'click-1', 'Test Offer');

      expect(result).toBeDefined();
      expect(mockNotifications.onOfferCompleted).toHaveBeenCalledWith('user-1', 'Test Offer', '5');
    });
  });

  describe('requestWithdrawal', () => {
    const dto = {
      method: 'PAYPAL' as const,
      amount: 25.0,
      details: { email: 'paypal@test.com' },
    };

    it('should create withdrawal request', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
        mockTx.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'ACTIVE', riskScore: 20 });
        mockTx.wallet.findUnique.mockResolvedValue({
          availableBalance: { toNumber: () => 100 },
        });
        mockTx.wallet.update.mockResolvedValue({});
        mockTx.withdrawal.create.mockResolvedValue({
          id: 'wd-1', userId: 'user-1', method: 'PAYPAL',
          amount: 25.0, status: 'PENDING', details: { email: 'paypal@test.com' },
        });
        mockTx.transaction.create.mockResolvedValue({});
        return cb(mockTx);
      });

      const result = await service.requestWithdrawal('user-1', dto);

      expect(result).toBeDefined();
      expect(mockNotifications.onWithdrawalSubmitted).toHaveBeenCalledWith('user-1', '25', 'PAYPAL');
    });

    it('should reject withdrawal for frozen accounts', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
        mockTx.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'FROZEN' });
        return cb(mockTx);
      });

      await expect(service.requestWithdrawal('user-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject if insufficient balance', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
        mockTx.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'ACTIVE', riskScore: 20 });
        mockTx.wallet.findUnique.mockResolvedValue({
          availableBalance: { toNumber: () => 10 },
        });
        return cb(mockTx);
      });

      await expect(service.requestWithdrawal('user-1', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveWithdrawal', () => {
    it('should approve and send notification', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
        mockTx.withdrawal.findUnique.mockResolvedValue({
          id: 'wd-1', userId: 'user-1', status: 'PENDING', amount: 25.0, method: 'PAYPAL',
        });
        mockTx.withdrawal.update.mockResolvedValue({
          id: 'wd-1', userId: 'user-1', status: 'APPROVED', amount: 25.0, method: 'PAYPAL',
        });
        mockTx.transaction.updateMany.mockResolvedValue({});
        return cb(mockTx);
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@test.com' });

      await service.approveWithdrawal('wd-1');

      expect(mockNotifications.onWithdrawalApproved).toHaveBeenCalled();
    });
  });

  describe('rejectWithdrawal', () => {
    it('should reject and refund', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
        mockTx.withdrawal.findUnique.mockResolvedValue({
          id: 'wd-1', userId: 'user-1', status: 'PENDING', amount: 25.0,
        });
        mockTx.wallet.update.mockResolvedValue({});
        mockTx.withdrawal.update.mockResolvedValue({
          id: 'wd-1', userId: 'user-1', status: 'REJECTED', amount: 25.0,
        });
        mockTx.transaction.updateMany.mockResolvedValue({});
        return cb(mockTx);
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@test.com' });

      await service.rejectWithdrawal('wd-1', 'Policy violation');

      expect(mockNotifications.onWithdrawalRejected).toHaveBeenCalled();
    });
  });

  describe('getTransactions / getWithdrawals', () => {
    it('should return user transactions', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([{ id: 'tx-1', amount: 10 }]);
      const result = await service.getTransactions('user-1');
      expect(result).toHaveLength(1);
    });

    it('should return user withdrawals', async () => {
      mockPrisma.withdrawal.findMany.mockResolvedValue([{ id: 'wd-1', amount: 25 }]);
      const result = await service.getWithdrawals('user-1');
      expect(result).toHaveLength(1);
    });
  });
});
