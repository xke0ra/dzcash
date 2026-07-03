import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../../src/notification/notification.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EmailService } from '../../src/email/email.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: PrismaService;
  let emailService: EmailService;

  const mockPrisma = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockEmailService = {
    sendMail: jest.fn().mockResolvedValue(true),
    sendWithdrawalApproved: jest.fn().mockResolvedValue(true),
    sendWithdrawalRejected: jest.fn().mockResolvedValue(true),
    sendFraudAlert: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);
    jest.clearAllMocks();
  });

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-1',
    type: 'OFFER_COMPLETED',
    title: 'Test',
    body: 'Test body',
    data: {},
    read: false,
    emailed: false,
    createdAt: new Date(),
  };

  describe('create', () => {
    it('should create in-app notification', async () => {
      mockPrisma.notification.create.mockResolvedValue(mockNotification);

      const result = await service.create({
        userId: 'user-1',
        type: 'OFFER_COMPLETED',
        title: 'Test',
        body: 'Test body',
        channel: 'IN_APP',
      });

      expect(result).toBeDefined();
      expect(mockEmailService.sendMail).not.toHaveBeenCalled();
    });

    it('should create and send email for BOTH channel', async () => {
      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@test.com' });

      const result = await service.create({
        userId: 'user-1',
        type: 'WITHDRAWAL_STATUS',
        title: 'Withdrawal Approved',
        body: 'Your withdrawal was approved.',
        channel: 'BOTH',
      });

      expect(result).toBeDefined();
      expect(mockEmailService.sendMail).toHaveBeenCalled();
    });
  });

  describe('findMany', () => {
    it('should return paginated notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([mockNotification]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.findMany('user-1', { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
    });
  });

  describe('markRead / markAllRead', () => {
    it('should mark single notification as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });

      await service.markRead('notif-1', 'user-1');
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
        data: { read: true },
      });
    });

    it('should mark all as read', async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      await service.markAllRead('user-1');
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');
      expect(result).toBe(5);
    });
  });

  describe('delete', () => {
    it('should delete notification', async () => {
      mockPrisma.notification.deleteMany.mockResolvedValue({ count: 1 });

      await service.delete('notif-1', 'user-1');
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
      });
    });
  });

  describe('trigger methods', () => {
    it('onOfferCompleted should create notification', async () => {
      mockPrisma.notification.create.mockResolvedValue(mockNotification);

      await service.onOfferCompleted('user-1', 'Test Offer', '5.00');
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'OFFER_COMPLETED',
            userId: 'user-1',
          }),
        }),
      );
    });

    it('onWithdrawalApproved should create notification and email', async () => {
      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@test.com' });

      await service.onWithdrawalApproved('user-1', '25', 'PAYPAL', 'test@test.com');
      expect(mockEmailService.sendWithdrawalApproved).toHaveBeenCalledWith('test@test.com', '25', 'PAYPAL');
    });

    it('onFraudAlert should create notification and email', async () => {
      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@test.com' });

      await service.onFraudAlert('user-1', 'VPN_DETECTED', 45, 'test@test.com');
      expect(mockEmailService.sendFraudAlert).toHaveBeenCalledWith('test@test.com', 'VPN_DETECTED');
    });
  });
});
