import { Controller, Get, Delete, Patch, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getProfile(@Req() req: Request & { user: { id: string } }) {
    return this.usersService.getProfile(req.user.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Req() req: Request & { user: { id: string } }) {
    await this.usersService.softDelete(req.user.id);
    return { message: 'Account deleted successfully' };
  }

  @Patch('me/notification-preferences')
  @HttpCode(HttpStatus.OK)
  async updateNotificationPrefs(
    @Req() req: Request & { user: { id: string } },
    @Body() prefs: Record<string, boolean>,
  ) {
    await this.usersService.updateNotificationPrefs(req.user.id, prefs);
    return { message: 'Preferences saved' };
  }

  @Get('referrals')
  async getReferrals(@Req() req: Request & { user: { id: string } }) {
    return this.usersService.getReferrals(req.user.id);
  }
}
