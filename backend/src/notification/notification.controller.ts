import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, Res, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    private notificationService: NotificationService,
    private pushService: PushService,
  ) {}

  @Get()
  async findAll(@Req() req: Request & { user: { id: string } }, @Query('page') page?: string, @Query('limit') limit?: string, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationService.findMany(req.user.id, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: Request & { user: { id: string } }) {
    const count = await this.notificationService.getUnreadCount(req.user.id);
    return { count };
  }

  @Get('stream')
  stream(@Req() req: Request & { user: { id: string } }, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial heartbeat
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const userId = req.user.id;

    const subscription = this.notificationService.notification$
      .pipe(filter((event) => event.userId === userId))
      .subscribe({
        next: (event) => {
          res.write(`event: notification\ndata: ${JSON.stringify(event.notification)}\n\n`);
        },
        error: () => {},
        complete: () => {},
      });

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000);

    req.on('close', () => {
      subscription.unsubscribe();
      clearInterval(heartbeat);
    });
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: Request & { user: { id: string } }) {
    await this.notificationService.markRead(id, req.user.id);
    return { success: true };
  }

  @Post('read-all')
  async markAllRead(@Req() req: Request & { user: { id: string } }) {
    await this.notificationService.markAllRead(req.user.id);
    return { success: true };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request & { user: { id: string } }) {
    await this.notificationService.delete(id, req.user.id);
    return { success: true };
  }
}
