import { Controller, Get, Post, Query, Req, UseGuards, Param, Headers, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IpWhitelistGuard } from '../common/ip-whitelist.guard';
import { Request } from 'express';

@Controller('tracking')
export class TrackingController {
  constructor(private trackingService: TrackingService) {}

  @Get('click')
  @UseGuards(JwtAuthGuard)
  async registerClick(
    @Query('offerId') offerId: string,
    @Req() req: Request & { user: { id: string } },
  ) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const fingerprint = req.headers['x-device-fingerprint'] as string;
    return this.trackingService.createClick(req.user.id, offerId, ip, userAgent, fingerprint);
  }

  @Get('postback/:provider')
  @UseGuards(IpWhitelistGuard)
  @HttpCode(HttpStatus.OK)
  async handleGetPostback(
    @Param('provider') provider: string,
    @Query() query: Record<string, any>,
    @Headers() headers: Record<string, any>,
    @Body() body: Record<string, any>,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return this.trackingService.handlePostback(provider, query, headers, body, ip);
  }

  @Post('postback/:provider')
  @UseGuards(IpWhitelistGuard)
  @HttpCode(HttpStatus.OK)
  async handlePostPostback(
    @Param('provider') provider: string,
    @Query() query: Record<string, any>,
    @Headers() headers: Record<string, any>,
    @Body() body: Record<string, any>,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    return this.trackingService.handlePostback(provider, query, headers, body, ip);
  }
}
