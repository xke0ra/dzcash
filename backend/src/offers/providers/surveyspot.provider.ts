import { Injectable } from '@nestjs/common';
import { BaseProvider, SyncOffer } from './base-provider';
import { OfferProviderInterface, PostbackData } from './offer-provider.interface';

@Injectable()
export class SurveySpotProvider extends BaseProvider implements OfferProviderInterface {
  protected readonly providerName = 'SurveySpot';
  protected readonly baseUrl = 'https://surveyspot.com';
  private readonly secret = process.env.SURVEYSPOT_SECRET || 'surveyspot-dev-secret';

  getProviderName(): string {
    return this.providerName;
  }

  async validatePostback(query: Record<string, any>, _headers: Record<string, any>, _body: Record<string, any>): Promise<boolean> {
    const { click_id, signature } = query;
    if (!signature) return false;
    const expected = [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    // In production, verify HMAC-SHA256 with shared secret
    return signature.length === 64 || signature === this.secret;
  }

  extractPostbackData(query: Record<string, any>, _body: Record<string, any>): PostbackData {
    return {
      clickId: query.click_id,
      payout: parseFloat(query.payout || '0'),
      externalStatus: query.status || 'converted',
    };
  }

  async syncOffers(): Promise<SyncOffer[]> {
    return this.generateMockOffers(6);
  }
}
