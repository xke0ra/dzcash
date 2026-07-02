import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationService } from './notification.service';
import { User } from '../auth/decorators/user.decorator';

@Controller('api/notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationController {
  constructor(private service: NotificationService) {}

  @Get()
  async findAll(
    @User('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.service.findMany(userId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  async unreadCount(@User('id') userId: string) {
    const count = await this.service.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @User('id') userId: string) {
    await this.service.markRead(id, userId);
    return { success: true };
  }

  @Post('read-all')
  async markAllRead(@User('id') userId: string) {
    await this.service.markAllRead(userId);
    return { success: true };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @User('id') userId: string) {
    await this.service.delete(id, userId);
    return { success: true };
  }
}
