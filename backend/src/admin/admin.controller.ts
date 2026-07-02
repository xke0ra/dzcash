import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpStatus, HttpCode, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { PaginationQueryDto, UpdateUserStatusDto, UpdateUserRoleDto, OverrideRiskScoreDto, CreateOfferDto, UpdateOfferDto, RejectWithdrawalDto, ReviewFraudDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  async getUsers(@Query() query: PaginationQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: any,
  ) {
    return this.adminService.updateUserStatus(id, dto.status, dto.reason, req.user?.id);
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: any,
  ) {
    return this.adminService.updateUserRole(id, dto.role, req.user?.id);
  }

  @Post('users/:id/risk-override')
  @HttpCode(HttpStatus.OK)
  async overrideRiskScore(
    @Param('id') id: string,
    @Body() dto: OverrideRiskScoreDto,
    @Req() req: any,
  ) {
    return this.adminService.overrideRiskScore(id, dto.score, dto.reason, req.user?.id);
  }

  @Get('withdrawals')
  async getWithdrawals(@Query() query: PaginationQueryDto) {
    return this.adminService.getWithdrawals(query);
  }

  @Post('withdrawals/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveWithdrawal(@Param('id') id: string, @Req() req: any) {
    return this.adminService.approveWithdrawal(id, req.user?.id);
  }

  @Post('withdrawals/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectWithdrawal(
    @Param('id') id: string,
    @Body() dto: RejectWithdrawalDto,
    @Req() req: any,
  ) {
    return this.adminService.rejectWithdrawal(id, dto.reason, req.user?.id);
  }

  @Get('offers')
  async getOffers(@Query() query: PaginationQueryDto) {
    return this.adminService.getOffers(query);
  }

  @Post('offers')
  @HttpCode(HttpStatus.CREATED)
  async createOffer(@Body() dto: CreateOfferDto) {
    return this.adminService.createOffer(dto);
  }

  @Patch('offers/:id')
  async updateOffer(@Param('id') id: string, @Body() dto: UpdateOfferDto) {
    return this.adminService.updateOffer(id, dto);
  }

  @Post('offers/:id/toggle')
  @HttpCode(HttpStatus.OK)
  async toggleOfferStatus(@Param('id') id: string) {
    return this.adminService.toggleOfferStatus(id);
  }

  @Get('fraud')
  async getFraudLogs(@Query() query: PaginationQueryDto) {
    return this.adminService.getFraudLogs(query);
  }

  @Get('fraud/user/:userId')
  async getFraudLogsByUser(@Param('userId') userId: string) {
    return this.adminService.getFraudLogsByUser(userId);
  }

  @Get('audit-logs')
  async getAuditLogs(@Query() query: PaginationQueryDto) {
    return this.adminService.getAuditLogs(query);
  }
}