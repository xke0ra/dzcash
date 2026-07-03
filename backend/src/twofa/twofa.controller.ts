import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { TwofaService } from './twofa.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('2fa')
export class TwofaController {
  constructor(private twofaService: TwofaService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async generate(@Req() req: Request & { user: { id: string; email: string } }) {
    return this.twofaService.generateSecret(req.user.id, req.user.email);
  }

  @Post('enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enable(
    @Req() req: Request & { user: { id: string } },
    @Body() body: { token: string },
  ) {
    return this.twofaService.enable(req.user.id, body.token);
  }

  @Post('disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disable(
    @Req() req: Request & { user: { id: string } },
    @Body() body: { token?: string },
  ) {
    return this.twofaService.disable(req.user.id, body.token);
  }
}
