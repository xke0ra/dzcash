import { Injectable } from '@nestjs/common';
import { BaseProvider, SyncOffer } from './base-provider';
import { OfferProviderInterface, PostbackData } from './offer-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class OfferToroProvider extends BaseProvider implements OfferProviderInterface {
  protected readonly providerName = 'OfferToro';
  protected readonly baseUrl = 'https://offertoro.com';
  private readonly secret = process.env.OFFERTORO_SECRET || 'offertoro-dev-secret';

  getProviderName(): string {
    return this.providerName;
  }

  async validatePostback(query: Record<string, any>, _headers: Record<string, any>, _body: Record<string, any>): Promise<boolean> {
    const { o_id, click_id, signature } = query;
    if (!signature) return false;
    const expected = crypto.createHash('md5').update(`${o_id}:${click_id}:${this.secret}`).digest('hex');
    return signature === expected;
  }

  extractPostbackData(query: Record<string, any>, _body: Record<string, any>): PostbackData {
    return {
      clickId: query.click_id,
      payout: parseFloat(query.payout || '0'),
      externalStatus: query.status || 'completed',
      signature: query.signature,
    };
  }

  async syncOffers(): Promise<SyncOffer[]> {
    return this.generateMockOffers(10);
  }
}
