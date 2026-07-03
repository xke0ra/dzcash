import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpStatus, HttpCode, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';
import { FraudService } from '../fraud/fraud.service';
import { PaginationQueryDto, UpdateUserStatusDto, UpdateUserRoleDto, OverrideRiskScoreDto, CreateOfferDto, UpdateOfferDto, CreateCategoryDto, UpdateCategoryDto, RejectWithdrawalDto, ReviewFraudDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private fraudService: FraudService,
  ) {}

  // Stats
  @Get('stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // Users
  @Get('users')
  async getUsers(@Query() query: PaginationQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id/status')
  async updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto, @Req() req: any) {
    return this.adminService.updateUserStatus(id, dto.status, dto.reason, req.user?.id);
  }

  @Patch('users/:id/role')
  async updateUserRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto, @Req() req: any) {
    return this.adminService.updateUserRole(id, dto.role, req.user?.id);
  }

  @Post('users/:id/risk-override')
  @HttpCode(HttpStatus.OK)
  async overrideRiskScore(@Param('id') id: string, @Body() dto: OverrideRiskScoreDto, @Req() req: any) {
    return this.adminService.overrideRiskScore(id, dto.score, dto.reason, req.user?.id);
  }

  // Withdrawals
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
  async rejectWithdrawal(@Param('id') id: string, @Body() dto: RejectWithdrawalDto, @Req() req: any) {
    return this.adminService.rejectWithdrawal(id, dto.reason, req.user?.id);
  }

  // Offers
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

  // Offer Sync
  @Post('offers/sync')
  @HttpCode(HttpStatus.OK)
  async syncOffers() {
    return this.adminService.syncAllOffers();
  }

  @Get('offers/sync-status')
  async getSyncStatus() {
    return this.adminService.getSyncStatus();
  }

  // Categories
  @Get('categories')
  async getCategories() {
    return this.adminService.getCategories();
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminService.createCategory(dto);
  }

  @Patch('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.adminService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id);
  }

  // Fraud
  @Get('fraud')
  async getFraudLogs(@Query() query: PaginationQueryDto) {
    return this.adminService.getFraudLogs(query);
  }

  @Get('fraud/user/:userId')
  async getFraudLogsByUser(@Param('userId') userId: string) {
    return this.adminService.getFraudLogsByUser(userId);
  }

  @Post('fraud/:id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveFraudLog(
    @Param('id') id: string,
    @Body() dto: ReviewFraudDto,
    @Req() req: any,
  ) {
    return this.fraudService.resolveFraudLog(id, req.user?.id || 'system', dto.action, dto.notes);
  }

  @Post('fraud/:id/reverse')
  @HttpCode(HttpStatus.OK)
  async reverseFraudTransaction(@Param('id') id: string, @Req() req: any) {
    return this.fraudService.reverseFraudTransaction(id, req.user?.id || 'system');
  }

  @Get('fraud/rules')
  async getFraudRules() {
    return this.fraudService.getFraudRules();
  }

  @Patch('fraud/rules/:id')
  async updateFraudRule(
    @Param('id') id: string,
    @Body() body: { weight?: number; enabled?: boolean; threshold?: number | null },
  ) {
    return this.fraudService.updateFraudRule(id, body);
  }

  @Get('fraud/analytics')
  async getFraudAnalytics() {
    return this.fraudService.getAnalytics();
  }

  @Get('fraud/rules/recommendations')
  async getFraudRuleRecommendations() {
    return this.fraudService.getRuleRecommendations();
  }

  @Post('fraud/recompute-baseline/:userId')
  @HttpCode(HttpStatus.OK)
  async recomputeBaseline(@Param('userId') userId: string) {
    return this.fraudService.recomputeBaseline(userId);
  }

  // Audit Logs
  @Get('audit-logs')
  async getAuditLogs(@Query() query: PaginationQueryDto) {
    return this.adminService.getAuditLogs(query);
  }
}
