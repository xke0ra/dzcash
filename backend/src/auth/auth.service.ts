import { Injectable, Logger, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TwofaService } from '../twofa/twofa.service';
import { GamificationService } from '../gamification/gamification.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private twofaService: TwofaService,
    private gamificationService: GamificationService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    let referredById: string | null = null;
    if (dto.referredByCode) {
      const referrer = await this.prisma.user.findUnique({
        where: { referralCode: dto.referredByCode.toUpperCase() },
      });
      if (!referrer) {
        throw new BadRequestException('Invalid referral code');
      }
      referredById = referrer.id;
    }

    // Generate unique referral code
    let referralCode = '';
    let codeExists = true;
    while (codeExists) {
      referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existingCode = await this.prisma.user.findUnique({
        where: { referralCode },
      });
      if (!existingCode) {
        codeExists = false;
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user and wallet atomically in a transaction
    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          referralCode,
          referredById,
        },
      });

      await tx.wallet.create({
        data: {
          userId: user.id,
          pendingBalance: 0.00,
          availableBalance: 0.00,
        },
      });

      return user;
    });

    this.emailService.sendWelcome(newUser.email).catch(() => {});

    if (referredById) {
      this.gamificationService.handleReferralBonus(referredById, newUser.id).catch((err) =>
        this.logger.warn(`Gamification referral hook failed: ${err.message}`),
      );
    }

    return {
      message: 'Registration successful',
      userId: newUser.id,
      email: newUser.email,
      referralCode: newUser.referralCode,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('This account has been deleted');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('This account has been suspended');
    }

    if (user.totpEnabled) {
      return { needsTwoFactor: true, userId: user.id };
    }

    const tokens = await this.generateTokens(user.id, user.email);

    // Store refresh token session in database
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress,
        userAgent,
      },
    });

    // Track daily login streak (fire-and-forget)
    this.gamificationService.trackDailyLogin(user.id).catch((err) =>
      this.logger.warn(`Failed to track daily login: ${err.message}`),
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        role: user.role,
        riskScore: user.riskScore,
      },
      ...tokens,
    };
  }

  async verifyTwoFactor(userId: string, token: string, ipAddress?: string, userAgent?: string) {
    const valid = await this.twofaService.verify(userId, token);
    if (!valid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const tokens = await this.generateTokens(user.id, user.email);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress,
        userAgent,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        role: user.role,
        riskScore: user.riskScore,
      },
      ...tokens,
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.session.deleteMany({
      where: { refreshToken },
    });
    return { message: 'Logged out successfully' };
  }

  async logoutAllSessions(userId: string) {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
    return { message: 'All sessions logged out successfully' };
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    if (session.user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User is suspended');
    }

    const tokens = await this.generateTokens(session.user.id, session.user.email);

    // Rotate refresh token (delete old session, create new)
    await this.prisma.session.delete({ where: { id: session.id } });
    await this.prisma.session.create({
      data: {
        userId: session.user.id,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress,
        userAgent,
      },
    });

    return tokens;
  }

  private async generateTokens(userId: string, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const role = user?.role || 'USER';
    const payload = { sub: userId, email, role };
    
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
