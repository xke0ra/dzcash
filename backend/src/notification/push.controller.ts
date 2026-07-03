import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private pushService: PushService) {}

  @Post('subscribe')
  async subscribe(
    @Req() req: Request & { user: { id: string } },
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string }; subscription?: { endpoint: string; keys: { p256dh: string; auth: string } }; userAgent?: string },
  ) {
    const subData = body.subscription || body;
    await this.pushService.subscribe(req.user.id, { endpoint: subData.endpoint, keys: subData.keys }, body.userAgent || req.headers['user-agent']);
    return { message: 'Subscribed successfully' };
  }

  @Post('unsubscribe')
  async unsubscribe(
    @Req() req: Request & { user: { id: string } },
    @Body() body?: { endpoint?: string },
  ) {
    await this.pushService.unsubscribe(req.user.id, body?.endpoint);
    return { message: 'Unsubscribed successfully' };
  }
}
