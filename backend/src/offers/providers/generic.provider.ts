import { Injectable } from '@nestjs/common';
import { BaseProvider, SyncOffer } from './base-provider';
import { OfferProviderInterface, PostbackData } from './offer-provider.interface';

@Injectable()
export class GenericProvider extends BaseProvider implements OfferProviderInterface {
  protected readonly providerName = 'Generic';
  protected readonly baseUrl = 'https://generic-offers.com';
  private readonly token = process.env.GENERIC_TOKEN || 'generic-dev-token';

  getProviderName(): string {
    return this.providerName;
  }

  async validatePostback(query: Record<string, any>, _headers: Record<string, any>, _body: Record<string, any>): Promise<boolean> {
    return query.token === this.token;
  }

  extractPostbackData(query: Record<string, any>, _body: Record<string, any>): PostbackData {
    return {
      clickId: query.click_id,
      payout: parseFloat(query.payout || '0'),
      externalStatus: query.status || 'converted',
    };
  }

  async syncOffers(): Promise<SyncOffer[]> {
    return this.generateMockOffers(5);
  }
}
