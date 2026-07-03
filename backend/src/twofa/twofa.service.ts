import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class TwofaService {
  private readonly logger = new Logger(TwofaService.name);

  constructor(private prisma: PrismaService) {}

  async generateSecret(userId: string, email: string) {
    const secret = speakeasy.generateSecret({
      name: `DZCASH:${email}`,
      issuer: 'DZCASH',
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret.base32 },
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url || '');

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  async enable(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret) {
      throw new BadRequestException('2FA not initialized');
    }

    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });

    return { message: '2FA enabled successfully' };
  }

  async disable(userId: string, token?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    if (user.totpEnabled && token) {
      const verified = speakeasy.totp.verify({
        secret: user.totpSecret || '',
        encoding: 'base32',
        token,
        window: 1,
      });
      if (!verified) {
        throw new BadRequestException('Invalid verification code');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false },
    });

    return { message: '2FA disabled successfully' };
  }

  async verify(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpSecret || !user.totpEnabled) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }
}
