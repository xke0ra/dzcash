import { Injectable, Logger } from '@nestjs/common';
import { OfferProviderInterface, PostbackData } from './offer-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class CpxProvider implements OfferProviderInterface {
  private readonly logger = new Logger(CpxProvider.name);
  private readonly secret = process.env.CPX_SECRET || 'cpx_secret_key_123456';

  getProviderName(): string {
    return 'CPX';
  }

  async validatePostback(
    query: Record<string, any>,
    headers: Record<string, any>,
    body: Record<string, any>,
  ): Promise<boolean> {
    const { click_id, payout, status, signature } = query;

    if (!click_id || !payout || !signature) {
      this.logger.error('CPX Postback missing required fields');
      return false;
    }

    // CPX Signature Scheme: HMAC-SHA256 of "click_id:payout:status" using CPX_SECRET
    const computedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(`${click_id}:${payout}:${status}`)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedSignature),
      Buffer.from(signature),
    );

    if (!isValid) {
      this.logger.warn(`CPX Postback signature invalid. Expected: ${computedSignature}, Received: ${signature}`);
    }

    return isValid;
  }

  extractPostbackData(query: Record<string, any>, body: Record<string, any>): PostbackData {
    return {
      clickId: query.click_id,
      payout: parseFloat(query.payout),
      externalStatus: query.status,
    };
  }
}
