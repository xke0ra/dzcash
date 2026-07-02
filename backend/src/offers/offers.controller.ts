import { Controller, Get, Param, UseGuards, Query, Res, HttpStatus } from '@nestjs/common';
import { OffersService } from './offers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';
import * as crypto from 'crypto';

@Controller('offers')
export class OffersController {
  constructor(private offersService: OffersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getOffers() {
    return this.offersService.getOffers();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOfferById(@Param('id') id: string) {
    return this.offersService.getOfferById(id);
  }

  // --- External Offer Network Simulation Endpoints (For Testing / Demo) ---

  @Get('cpx/mock')
  async mockCpxOffer(@Query('click_id') clickId: string, @Res() res: Response) {
    if (!clickId) {
      return res.status(HttpStatus.BAD_REQUEST).send('Missing click_id parameter');
    }

    const payout = '1.2000';
    const status = '1';
    const secret = process.env.CPX_SECRET || 'cpx_secret_key_123456';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${clickId}:${payout}:${status}`)
      .digest('hex');

    const callbackUrl = `/api/tracking/postback/cpx?click_id=${clickId}&payout=${payout}&status=${status}&signature=${signature}`;

    const html = `
      <html>
        <head>
          <title>CPX Research Offer wall Simulator</title>
          <style>
            body { font-family: sans-serif; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); text-align: center; max-width: 400px; }
            h2 { color: #38bdf8; margin-top: 0; }
            button { background: #38bdf8; color: #0f172a; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; margin-top: 20px; transition: background 0.2s; }
            button:hover { background: #0ea5e9; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>CPX Research Mock Offer</h2>
            <p>You have clicked CPX Survey 101. To complete this mock offer, click the button below.</p>
            <p><strong>Click ID:</strong> <br/><code>${clickId}</code></p>
            <form method="POST" action="${callbackUrl}">
              <button type="submit">Complete Offer & Earn Payout</button>
            </form>
          </div>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.status(HttpStatus.OK).send(html);
  }

  @Get('offertoro/mock')
  async mockOffertoroOffer(@Query('click_id') clickId: string, @Res() res: Response) {
    if (!clickId) {
      return res.status(HttpStatus.BAD_REQUEST).send('Missing click_id parameter');
    }

    const payout = '5.0000';
    const oId = 'app-cpc-202';
    const status = '1';
    const secret = process.env.OFFERTORO_SECRET || 'offertoro_secret_key_abcdef';
    
    const sig = crypto
      .createHash('md5')
      .update(`${oId}:${clickId}:${secret}`)
      .digest('hex');

    const callbackUrl = `/api/tracking/postback/offertoro?click_id=${clickId}&payout=${payout}&o_id=${oId}&status=${status}&sig=${sig}`;

    const html = `
      <html>
        <head>
          <title>OfferToro wall Simulator</title>
          <style>
            body { font-family: sans-serif; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); text-align: center; max-width: 400px; }
            h2 { color: #f43f5e; margin-top: 0; }
            button { background: #f43f5e; color: white; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; margin-top: 20px; transition: background 0.2s; }
            button:hover { background: #e11d48; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>OfferToro Mock Offer</h2>
            <p>You have clicked Coin Master Offer. To complete this mock offer, click the button below.</p>
            <p><strong>Click ID:</strong> <br/><code>${clickId}</code></p>
            <form method="POST" action="${callbackUrl}">
              <button type="submit">Complete Coin Master Offer</button>
            </form>
          </div>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.status(HttpStatus.OK).send(html);
  }

  @Get('generic/mock')
  async mockGenericOffer(@Query('click_id') clickId: string, @Res() res: Response) {
    if (!clickId) {
      return res.status(HttpStatus.BAD_REQUEST).send('Missing click_id parameter');
    }

    const payout = '0.5000';
    const token = process.env.GENERIC_PROVIDER_TOKEN || 'generic_token_xyz_987';
    const status = 'success';

    const callbackUrl = `/api/tracking/postback/generic?click_id=${clickId}&payout=${payout}&token=${token}&status=${status}`;

    const html = `
      <html>
        <head>
          <title>Generic Offer Simulator</title>
          <style>
            body { font-family: sans-serif; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); text-align: center; max-width: 400px; }
            h2 { color: #10b981; margin-top: 0; }
            button { background: #10b981; color: #0f172a; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; margin-top: 20px; transition: background 0.2s; }
            button:hover { background: #059669; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Generic Mock Offer</h2>
            <p>You have clicked Platform Newsletter Offer. To complete this mock offer, click the button below.</p>
            <p><strong>Click ID:</strong> <br/><code>${clickId}</code></p>
            <form method="POST" action="${callbackUrl}">
              <button type="submit">Complete Newsletter Offer</button>
            </form>
          </div>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.status(HttpStatus.OK).send(html);
  }
}
