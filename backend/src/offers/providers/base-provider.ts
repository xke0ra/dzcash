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

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function bool(probability: number = 0.5): boolean {
  return Math.random() < probability;
}

export abstract class BaseProvider {
  protected abstract readonly providerName: string;
  protected abstract readonly baseUrl: string;

  protected generateMockOffers(count: number): SyncOffer[] {
    const categories = ['survey', 'video', 'download', 'game', 'signup', 'shopping', 'finance', 'health', 'travel', 'social'];
    const devices = ['Desktop', 'Mobile', 'Tablet'];
    const countries = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'NO', 'DK', 'FI', 'JP', 'BR'];

    const offerTemplates = [
      { name: 'Quick Survey', desc: 'Share your opinion and earn rewards. Takes 3-5 minutes.' },
      { name: 'App Install', desc: 'Download and install the app, reach level 5 to earn.' },
      { name: 'Video Watch', desc: 'Watch a short video series and earn cash rewards.' },
      { name: 'Email Signup', desc: 'Sign up for a free newsletter with your email.' },
      { name: 'Free Trial', desc: 'Start a free trial subscription. Cancel anytime.' },
      { name: 'Social Follow', desc: 'Follow our social media accounts and earn.' },
      { name: 'Quiz Completion', desc: 'Complete a fun quiz about your interests.' },
      { name: 'Product Review', desc: 'Review a product and share your honest feedback.' },
      { name: 'Referral Share', desc: 'Share a referral link with friends and earn per signup.' },
      { name: 'Wallet Connect', desc: 'Connect your crypto wallet to verify your identity.' },
    ];

    const offers: SyncOffer[] = [];
    for (let i = 1; i <= count; i++) {
      const template = pick(offerTemplates);
      const reward = parseFloat(rand(0.1, 5.0).toFixed(4));
      const payout = parseFloat((reward * rand(1.5, 3.0)).toFixed(4));
      const cat = pick(categories);
      const offerDevices = [pick(devices)];
      if (bool(0.6)) offerDevices.push(pick(devices));

      offers.push({
        providerId: `${this.providerName.toLowerCase()}-${i}-${Date.now()}`,
        name: `${this.providerName} ${template.name} #${i}`,
        description: `[${this.providerName}] ${template.desc}`,
        payoutAmount: payout,
        rewardAmount: reward,
        targetUrl: `${this.baseUrl}/click?click_id={click_id}&offer_id=${i}`,
        imageUrl: `https://picsum.photos/seed/${this.providerName}${i}/400/300`,
        category: cat,
        countries: bool(0.7) ? [pick(countries)] : countries.slice(0, randInt(3, 8)),
        devices: [...new Set(offerDevices)],
        requirements: 'Must be a new user. IP/country restrictions apply.',
        instructions: '1. Click start. 2. Complete the offer. 3. Wait for reward confirmation.',
        providerMetadata: { minLevel: randInt(1, 5), featured: bool(0.2) },
      });
    }
    return offers;
  }
}
