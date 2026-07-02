import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { FraudService } from './fraud.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

@Controller('fraud')
@UseGuards(JwtAuthGuard)
export class FraudController {
  constructor(
    private fraudService: FraudService,
    private prisma: PrismaService,
  ) {}

  @Get('logs')
  async getMyFraudLogs(@Req() req: Request & { user: { id: string } }) {
    return this.prisma.fraudLog.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
