import { Injectable } from '@nestjs/common';
import { BaseProvider, SyncOffer } from './base-provider';
import { OfferProviderInterface, PostbackData } from './offer-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class CpxProvider extends BaseProvider implements OfferProviderInterface {
  protected readonly providerName = 'CPX';
  protected readonly baseUrl = 'https://cpxnetwork.com';
  private readonly secret = process.env.CPX_SECRET || 'cpx-dev-secret';

  getProviderName(): string {
    return this.providerName;
  }

  async validatePostback(query: Record<string, any>, _headers: Record<string, any>, _body: Record<string, any>): Promise<boolean> {
    const { click_id, payout, status, signature } = query;
    if (!signature) return false;
    const expected = crypto.createHmac('sha256', this.secret).update(`${click_id}:${payout}:${status}`).digest('hex');
    return signature === expected;
  }

  extractPostbackData(query: Record<string, any>, _body: Record<string, any>): PostbackData {
    return {
      clickId: query.click_id,
      payout: parseFloat(query.payout),
      externalStatus: query.status || 'converted',
      signature: query.signature,
    };
  }

  async syncOffers(): Promise<SyncOffer[]> {
    return this.generateMockOffers(8);
  }
}
