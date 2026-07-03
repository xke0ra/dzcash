import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        status: true,
        riskScore: true,
        referralCode: true,
        createdAt: true,
        notificationPrefs: true,
        wallet: {
          select: {
            pendingBalance: true,
            availableBalance: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getReferrals(userId: string) {
    const referrals = await this.prisma.user.findMany({
      where: { referredById: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return referrals;
  }

  async softDelete(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: 'SUSPENDED' as any,
      },
    });
  }

  async updateNotificationPrefs(userId: string, prefs: Record<string, boolean>) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationPrefs: prefs },
    });
  }
}
