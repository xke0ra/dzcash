import { Injectable, Logger } from '@nestjs/common';
import { OfferProviderInterface, PostbackData } from './offer-provider.interface';

@Injectable()
export class GenericProvider implements OfferProviderInterface {
  private readonly logger = new Logger(GenericProvider.name);
  private readonly secretToken = process.env.GENERIC_PROVIDER_TOKEN || 'generic_token_xyz_987';

  getProviderName(): string {
    return 'GENERIC';
  }

  async validatePostback(
    query: Record<string, any>,
    headers: Record<string, any>,
    body: Record<string, any>,
  ): Promise<boolean> {
    const { click_id, payout, token } = query;

    if (!click_id || !payout || !token) {
      this.logger.error('Generic Postback missing required fields');
      return false;
    }

    const isValid = token === this.secretToken;

    if (!isValid) {
      this.logger.warn(`Generic Postback token invalid. Expected: ${this.secretToken}, Received: ${token}`);
    }

    return isValid;
  }

  extractPostbackData(query: Record<string, any>, body: Record<string, any>): PostbackData {
    return {
      clickId: query.click_id,
      payout: parseFloat(query.payout),
      externalStatus: query.status || 'success',
    };
  }
}
