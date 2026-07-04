import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../../src/email/email.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let emailService: EmailService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    wallet: {
      create: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('test-jwt-token'),
    verify: jest.fn(),
  };

  const mockEmailService = {
    sendWelcome: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'password123',
      referredByCode: '',
    };

    it('should register a new user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null); // no existing user
      mockPrisma.$transaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
        const mockTx = {
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-1',
              email: 'test@example.com',
              referralCode: 'ABC123',
              createdAt: new Date(),
            }),
          },
          wallet: { create: jest.fn() },
        };
        return cb(mockTx);
      });

      const result = await service.register(registerDto);

      expect(result.message).toBe('Registration successful');
      expect(result.email).toBe('test@example.com');
      expect(emailService.sendWelcome).toHaveBeenCalledWith('test@example.com');
    });

    it('should reject duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'test@example.com' });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should reject invalid referral code', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // no existing user
        .mockResolvedValueOnce(null); // no referrer

      await expect(
        service.register({ ...registerDto, referredByCode: 'INVALID' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@example.com', password: 'password123' };

    it('should login successfully with valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        status: 'ACTIVE',
        role: 'USER',
        riskScore: 10,
      });
      mockPrisma.session.create.mockResolvedValue({ refreshToken: 'refresh-token' });

      const result = await service.login(loginDto);

      if ('needsTwoFactor' in result) {
        throw new Error('Expected full login result, got needsTwoFactor');
      }
      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('USER');
    });

    it('should reject invalid password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('wrong-password', 10),
        status: 'ACTIVE',
        role: 'USER',
        riskScore: 10,
      });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject suspended accounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        status: 'SUSPENDED',
        role: 'USER',
        riskScore: 90,
      });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should remove session on logout', async () => {
      mockPrisma.session.findUnique.mockResolvedValue({ id: 'session-1', userId: 'user-1' });
      mockPrisma.session.delete.mockResolvedValue({});

      await service.logout('valid-refresh-token');

      expect(mockPrisma.session.delete).toHaveBeenCalled();
    });

    it('should not throw for invalid session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      await expect(service.logout('invalid-token')).resolves.not.toThrow();
    });
  });
});
