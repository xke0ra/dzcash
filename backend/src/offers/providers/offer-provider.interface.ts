export interface PostbackData {
  clickId: string;
  payout: number;
  externalStatus: string;
  signature?: string;
}

export interface SyncOffer {
  providerId: string;
  name: string;
  description: string;
  payoutAmount: number;
  rewardAmount: number;
  targetUrl: string;
  imageUrl?: string;
  category?: string;
  countries?: string[];
  devices?: string[];
  requirements?: string;
  instructions?: string;
  providerMetadata?: Record<string, any>;
}

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

export interface OfferProviderInterface {
  getProviderName(): string;
  validatePostback(query: Record<string, any>, headers: Record<string, any>, body: Record<string, any>): Promise<boolean>;
  extractPostbackData(query: Record<string, any>, body: Record<string, any>): PostbackData;
  syncOffers(): Promise<SyncOffer[]>;
}
