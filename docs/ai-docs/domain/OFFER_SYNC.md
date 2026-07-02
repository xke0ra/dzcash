# Offer Synchronization - DZCASH

> **Purpose**: Specifications for syncing offers from provider APIs (PLANNED).

---

## Overview

Currently, DZCASH uses **mock offers** seeded on startup. In production, offers must be synced from provider APIs daily.

### Current State
```typescript
// backend/src/offers/offers.service.ts
async onModuleInit() {
  await this.seedMockOffers(); // Seeds 3 mock offers on start
}
```

### Target State
```typescript
// PLANNED: Cron job that syncs offers daily
@Cron('0 3 * * *') // Every day at 3:00 AM
async syncAllProviders() {
  await this.syncProvider(OfferProvider.CPX);
  await this.syncProvider(OfferProvider.OFFERTORO);
}
```

---

## Provider API Clients (PLANNED)

### CPX Research API
```typescript
// backend/src/offers/providers/cpx.client.ts (PLANNED)
class CpxApiClient {
  private baseUrl = 'https://api.cpxresearch.com';
  
  async fetchOffers(): Promise<CpxOffer[]> {
    // GET /api/v2/offers?api_key=${API_KEY}&format=json
    // Response transformed to internal format
    return offers.map(o => ({
      providerId: o.id.toString(),
      name: o.name,
      description: o.description,
      payoutAmount: o.payout,
      rewardAmount: o.payout * 0.75, // 75% payout to user
      targetUrl: o.tracking_url.replace('{subid}', '{click_id}'),
      category: o.category,
      countries: o.countries,
      deviceTypes: o.devices,
    }));
  }
}
```

### OfferToro API
```typescript
// backend/src/offers/providers/offertoro.client.ts (PLANNED)
class OfferToroApiClient {
  private baseUrl = 'https://api.offertoro.com';
  
  async fetchOffers(): Promise<OfferToroOffer[]> {
    // GET /api/v1/offers?api_key=${API_KEY}&format=json
    // Response includes work_flow, conversion requirements
  }
}
```

---

## Sync Service (PLANNED)

```typescript
// backend/src/offers/offers-sync.service.ts (PLANNED)
@Injectable()
export class OffersSyncService {
  constructor(
    private prisma: PrismaService,
    private cpxClient: CpxApiClient,
    private offerToroClient: OfferToroApiClient,
  ) {}

  async syncAllProviders(): Promise<SyncSummary> {
    const results = await Promise.allSettled([
      this.syncProvider(OfferProvider.CPX),
      this.syncProvider(OfferProvider.OFFERTORO),
    ]);
    
    return {
      cpx: this.summarize(results[0]),
      offertoro: this.summarize(results[1]),
      timestamp: new Date(),
    };
  }

  private async syncProvider(provider: OfferProvider): Promise<SyncResult> {
    const externalOffers = await this.fetchFromProvider(provider);
    return this.upsertOffers(provider, externalOffers);
  }

  private async upsertOffers(provider: OfferProvider, offers: ExternalOffer[]): Promise<SyncResult> {
    let created = 0, updated = 0, deactivated = 0;

    for (const offer of offers) {
      const existing = await this.prisma.offer.findUnique({
        where: { provider_providerId: { provider, providerId: offer.providerId } },
      });

      if (existing) {
        await this.prisma.offer.update({
          where: { id: existing.id },
          data: {
            name: offer.name,
            description: offer.description,
            payoutAmount: offer.payoutAmount,
            rewardAmount: offer.rewardAmount,
            targetUrl: offer.targetUrl,
            status: true,
          },
        });
        updated++;
      } else {
        await this.prisma.offer.create({
          data: {
            provider,
            providerId: offer.providerId,
            name: offer.name,
            description: offer.description,
            payoutAmount: offer.payoutAmount,
            rewardAmount: offer.rewardAmount,
            targetUrl: offer.targetUrl,
          },
        });
        created++;
      }
    }

    // Deactivate offers no longer in provider's list
    const providerIds = offers.map(o => o.providerId);
    const deactivatedCount = await this.prisma.offer.updateMany({
      where: {
        provider,
        providerId: { notIn: providerIds },
        status: true,
      },
      data: { status: false },
    });
    deactivated = deactivatedCount.count;

    return { created, updated, deactivated, total: offers.length };
  }
}
```

---

## Data Flow

```
Provider API                    Sync Service                    Database
    |                               |                             |
    |--- HTTP GET /api/offers ----->|                             |
    |<--- JSON offers[] ------------|                             |
    |                               |                             |
    |                         Transform to internal format        |
    |                               |                             |
    |                         For each offer:                     |
    |                               |--- Offer.findUnique ------->|
    |                               |   (by provider+providerId)  |
    |                               |                             |
    |                         if exists: Update                   |
    |                               |--- Offer.update ----------->|
    |                               |                             |
    |                         if new: Create                      |
    |                               |--- Offer.create ----------->|
    |                               |                             |
    |                         Deactivate missing offers            |
    |                               |--- Offer.updateMany ------->|
    |                               |   (status: false)           |
    |                               |                             |
    |                         Return SyncResult                    |
```

---

## Sync Metadata (PLANNED)

```prisma
model SyncMetadata {
  id          String   @id @default(uuid())
  provider    OfferProvider
  status      String   // SUCCESS | PARTIAL | FAILED
  offersCreated    Int @default(0)
  offersUpdated    Int @default(0)
  offersDeactivated Int @default(0)
  totalOffers      Int @default(0)
  errorLog    String?  // JSON array of errors
  startedAt   DateTime @default(now())
  completedAt DateTime?
  durationMs  Int?
}
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*