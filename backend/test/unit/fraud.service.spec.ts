import { Test, TestingModule } from '@nestjs/testing';
import { FraudService } from '../../src/fraud/fraud.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { NotificationService } from '../../src/notification/notification.service';

describe('FraudService', () => {
  let service: FraudService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    click: {
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    fraudLog: {
      create: jest.fn(),
    },
  };

  const mockNotifications = {
    onFraudAlert: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<FraudService>(FraudService);
    jest.clearAllMocks();
  });

  describe('calculateAndApplyRisk', () => {
    it('should return 0 score for clean user', async () => {
      mockPrisma.click.count.mockResolvedValue(0);
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.fraudLog.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'test@test.com', riskScore: 0, status: 'ACTIVE',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.calculateAndApplyRisk('user-1', '192.168.1.1', 'device-fp-1');

      expect(result).toBe(0);
      expect(mockNotifications.onFraudAlert).not.toHaveBeenCalled();
    });

    it('should detect VPN IP', async () => {
      mockPrisma.click.count.mockResolvedValue(0);
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.fraudLog.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'test@test.com', riskScore: 0, status: 'ACTIVE',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.calculateAndApplyRisk('user-1', '8.8.8.8');

      expect(result).toBeGreaterThan(0);
      expect(mockNotifications.onFraudAlert).toHaveBeenCalled();
    });

    it('should detect high velocity clicks', async () => {
      mockPrisma.click.count.mockResolvedValue(20); // more than 15 in 5 minutes
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.fraudLog.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'test@test.com', riskScore: 0, status: 'ACTIVE',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.calculateAndApplyRisk('user-1', '192.168.1.1');

      expect(result).toBeGreaterThanOrEqual(30);
    });

    it('should detect device clones', async () => {
      mockPrisma.click.count.mockResolvedValue(0);
      mockPrisma.user.count.mockResolvedValue(3); // 3 devices with same fingerprint
      mockPrisma.fraudLog.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'test@test.com', riskScore: 0, status: 'ACTIVE',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.calculateAndApplyRisk('user-1', '192.168.1.1', 'shared-device-fp');

      // clonesCount=3, penalty=min(3*25,50)=50, but first there might also be other triggers
      expect(result).toBeGreaterThanOrEqual(50);
    });

    it('should auto-freeze at score >= 70', async () => {
      mockPrisma.fraudLog.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'test@test.com', riskScore: 0, status: 'ACTIVE',
      });

      // Get 45 (VPN) + 30 (velocity) = 75 >= 70
      mockPrisma.click.count.mockResolvedValue(20);
      mockPrisma.user.count.mockResolvedValue(0);

      // Force VPN detection - use mock IP
      process.env.VPN_API_MOCK = 'true';

      const result = await service.calculateAndApplyRisk('user-1', '8.8.8.8');

      expect(result).toBeGreaterThanOrEqual(70);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FROZEN' }),
        }),
      );
    });
  });

  describe('checkGeoInconsistency', () => {
    it('should flag geo mismatch between click and postback', async () => {
      mockPrisma.click.findUnique.mockResolvedValue({
        id: 'click-1', ip: '192.168.1.1',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'test@test.com', riskScore: 10, status: 'ACTIVE',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.checkGeoInconsistency('user-1', 'click-1', '10.0.0.1');

      expect(result).toBe(true);
      expect(mockNotifications.onFraudAlert).toHaveBeenCalled();
    });

    it('should not flag localhost mismatches', async () => {
      mockPrisma.click.findUnique.mockResolvedValue({
        id: 'click-1', ip: '127.0.0.1',
      });

      const result = await service.checkGeoInconsistency('user-1', 'click-1', '127.0.0.1');

      expect(result).toBe(false);
    });
  });
});
