import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('push')
export class PushController {
  private readonly logger = new Logger(PushController.name);

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @Req() req: Request & { user: { id: string } },
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    this.logger.log(`Push subscription saved for user ${req.user.id}`);
    return { message: 'Subscribed successfully' };
  }

  @Post('unsubscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Req() req: Request & { user: { id: string } }) {
    this.logger.log(`Push subscription removed for user ${req.user.id}`);
    return { message: 'Unsubscribed successfully' };
  }
}
