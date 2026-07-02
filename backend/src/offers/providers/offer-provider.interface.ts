export interface PostbackData {
  clickId: string;
  payout: number;       // The amount the network pays us
  externalStatus: string; // The status reported by the network
  signature?: string;
}

export interface OfferProviderInterface {
  getProviderName(): string;
  validatePostback(query: Record<string, any>, headers: Record<string, any>, body: Record<string, any>): Promise<boolean>;
  extractPostbackData(query: Record<string, any>, body: Record<string, any>): PostbackData;
}
