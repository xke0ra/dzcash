import { Injectable, Logger } from '@nestjs/common';
import { OfferProviderInterface, PostbackData } from './offer-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class OfferToroProvider implements OfferProviderInterface {
  private readonly logger = new Logger(OfferToroProvider.name);
  private readonly secret = process.env.OFFERTORO_SECRET || 'offertoro_secret_key_abcdef';

  getProviderName(): string {
    return 'OFFERTORO';
  }

  async validatePostback(
    query: Record<string, any>,
    headers: Record<string, any>,
    body: Record<string, any>,
  ): Promise<boolean> {
    const { click_id, payout, o_id, sig } = query;

    if (!click_id || !payout || !o_id || !sig) {
      this.logger.error('OfferToro Postback missing required fields');
      return false;
    }

    // OfferToro Signature Scheme: MD5 of "o_id:click_id:secret"
    const hash = crypto.createHash('md5');
    const computedSignature = hash
      .update(`${o_id}:${click_id}:${this.secret}`)
      .digest('hex');

    const isValid = sig.toLowerCase() === computedSignature.toLowerCase();

    if (!isValid) {
      this.logger.warn(`OfferToro Postback signature invalid. Expected: ${computedSignature}, Received: ${sig}`);
    }

    return isValid;
  }

  extractPostbackData(query: Record<string, any>, body: Record<string, any>): PostbackData {
    return {
      clickId: query.click_id,
      payout: parseFloat(query.payout),
      externalStatus: query.status || '1',
    };
  }
}
