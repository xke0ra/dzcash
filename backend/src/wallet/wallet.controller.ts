import { Controller, Get, Post, Body, UseGuards, Req, Param, Query, ParseEnumPipe } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { WithdrawDto, BulkPayoutDto, ScheduleDto } from './dto/withdraw.dto';
import { WithdrawalMethod } from '@prisma/client';
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

  @Get('methods')
  async getMethods() {
    return this.walletService.getMethods();
  }

  @Get('fee-estimate')
  async getFeeEstimate(
    @Req() req: Request & { user: { id: string } },
    @Query('method', new ParseEnumPipe(WithdrawalMethod)) method: WithdrawalMethod,
    @Query('amount') amount: string,
  ) {
    return this.walletService.getFeeEstimate(req.user.id, method, parseFloat(amount));
  }

  @Post('bulk-approve')
  @UseGuards(AdminGuard)
  async bulkApprove(@Body() dto: BulkPayoutDto) {
    return this.walletService.bulkApprove(dto);
  }

  @Get('schedule')
  async getSchedule(@Req() req: Request & { user: { id: string } }) {
    return this.walletService.getSchedule(req.user.id);
  }

  @Post('schedule')
  async updateSchedule(
    @Req() req: Request & { user: { id: string } },
    @Body() dto: ScheduleDto,
  ) {
    return this.walletService.updateSchedule(req.user.id, dto);
  }

  @Post('schedule/delete')
  async deleteSchedule(@Req() req: Request & { user: { id: string } }) {
    return this.walletService.deleteSchedule(req.user.id);
  }

  @Post('process-scheduled')
  @UseGuards(AdminGuard)
  async processScheduled() {
    return this.walletService.processScheduledWithdrawals();
  }
}
