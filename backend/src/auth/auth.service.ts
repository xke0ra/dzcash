import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { crypto } from 'crypto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
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

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('This account has been suspended');
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
      secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-this-in-production',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'super-secret-jwt-refresh-key-change-this-in-production',
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
