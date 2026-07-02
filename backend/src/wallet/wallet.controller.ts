import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WithdrawDto } from './dto/withdraw.dto';
import { Request } from 'express';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('balance')
  async getBalance(@Req() req: Request & { user: { id: string } }) {
    return this.walletService.getBalance(req.user.id);
  }

  @Get('transactions')
  async getTransactions(@Req() req: Request & { user: { id: string } }) {
    return this.walletService.getTransactions(req.user.id);
  }

  @Get('withdrawals')
  async getWithdrawals(@Req() req: Request & { user: { id: string } }) {
    return this.walletService.getWithdrawals(req.user.id);
  }

  @Post('withdraw')
  async requestWithdrawal(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: WithdrawDto,
  ) {
    return this.walletService.requestWithdrawal(req.user.id, dto);
  }
}
