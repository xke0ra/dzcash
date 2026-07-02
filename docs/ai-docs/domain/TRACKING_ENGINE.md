# Tracking Engine - DZCASH

> **Purpose**: Complete specifications for click tracking, S2S postback handling, and offer redirection.

---

## Overview

The tracking engine is the core of DZCASH. It:
1. Generates unique click IDs for each offer click
2. Redirects users to advertiser offers with click_id tracking
3. Receives S2S postbacks from advertisers when offers are completed
4. Validates cryptographic signatures to prevent fake conversions
5. Credits user wallets atomically after validation

---

## Click Lifecycle

```
USER ACTION                    SYSTEM STATE          DATABASE
──────────────────────────────────────────────────────────────

1. User clicks "Start Offer"
   GET /api/tracking/click     Pre-fraud check      Click (CLICKED)
   ?offerId=xxx               +45, +25, +30         

2. User is redirected to      
   offerwall (new tab)        Click ID generated    { click_id, targetUrl }
                                         
3. User completes offer       Waiting...            Click (CLICKED)
   on advertiser site                              

4. Advertiser sends postback  Sig validation        Click (CONVERTED)
   GET/POST /api/tracking/    Fraud check           Wallet (pending+=reward)
   postback/:provider         +40 (geo)             Transaction (PENDING)
                                                     Referral (10% available)
```

---

## Click Registration

### Endpoint
```typescript
// GET /api/tracking/click?offerId=xxx
// Headers: Authorization: Bearer <token>
//          x-device-fingerprint: <hash> (optional)

@Get('click')
@UseGuards(JwtAuthGuard)
async registerClick(
  @Query('offerId') offerId: string,
  @Req() req: AuthenticatedRequest,
) {
  const ip = req.ip || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const fingerprint = req.headers['x-device-fingerprint'] as string;
  
  return this.trackingService.createClick(req.user.id, offerId, ip, userAgent, fingerprint);
}
```

### Service Implementation
```typescript
// backend/src/tracking/tracking.service.ts
async createClick(
  userId: string,
  offerId: string,
  ip: string,
  userAgent: string,
  deviceFingerprint?: string,
) {
  // 1. Find offer
  const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) throw new NotFoundException('Offer not found');

  // 2. Run fraud checks
  const riskScore = await this.fraudService.calculateAndApplyRisk(userId, ip, deviceFingerprint);
  
  // 3. Check user status after fraud check
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (user && (user.status === 'SUSPENDED' || user.status === 'FROZEN')) {
    throw new BadRequestException('Action blocked due to security risk score');
  }

  // 4. Create click record
  const click = await this.prisma.click.create({
    data: {
      userId,
      offerId,
      ip,
      userAgent,
      deviceFingerprint,
      status: ClickStatus.CLICKED,
    },
  });

  // 5. Replace {click_id} macro in target URL
  const targetUrl = offer.targetUrl.replace('{click_id}', click.id);

  return { clickId: click.id, targetUrl };
}
```

### Response
```json
{
  "clickId": "550e8400-e29b-41d4-a716-446655440000",
  "targetUrl": "https://advertiser.com/offer?sub_id=550e8400-e29b-41d4-a716-446655440000"
}
```

### Redirect Behavior
- Backend returns `targetUrl` to frontend
- Frontend opens `targetUrl` in new tab (`window.open(data.targetUrl, '_blank')`)
- This allows user to continue browsing DZCASH while completing offer

---

## Postback Processing

### Adapter Pattern
```typescript
// backend/src/offers/providers/offer-provider.interface.ts
export interface PostbackData {
  clickId: string;
  payout: number;         // Amount network pays DZCASH
  externalStatus: string; // Status from network
  signature?: string;
}

export interface OfferProviderInterface {
  getProviderName(): string;
  validatePostback(query, headers, body): Promise<boolean>;
  extractPostbackData(query, body): PostbackData;
}
```

### Endpoint
```typescript
// GET /api/tracking/postback/:provider?click_id=&payout=&sig=
// POST /api/tracking/postback/:provider (same params in body)

@Get('postback/:provider')
@HttpCode(HttpStatus.OK)
async handleGetPostback(
  @Param('provider') provider: string,
  @Query() query: Record<string, any>,
  @Headers() headers: Record<string, any>,
  @Body() body: Record<string, any>,
  @Req() req: Request,
) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  return this.trackingService.handlePostback(provider, query, headers, body, ip);
}
```

### Service Implementation
```typescript
// backend/src/tracking/tracking.service.ts
async handlePostback(
  provider: string,
  query: Record<string, any>,
  headers: Record<string, any>,
  body: Record<string, any>,
  postbackIp: string = '127.0.0.1',
) {
  // ↓ STEP 1: Get provider adapter
  const cleanProvider = provider.toUpperCase();
  let providerAdapter;
  
  switch (cleanProvider) {
    case 'CPX':       providerAdapter = this.cpxProvider; break;
    case 'OFFERTORO': providerAdapter = this.offerToroProvider; break;
    case 'GENERIC':   providerAdapter = this.genericProvider; break;
    default: throw new BadRequestException('Unsupported offer provider');
  }

  // ↓ STEP 2: Validate cryptographic signature
  const isValid = await providerAdapter.validatePostback(query, headers, body);
  if (!isValid) throw new BadRequestException('Invalid signature');

  // ↓ STEP 3: Extract standardized postback data
  const data = providerAdapter.extractPostbackData(query, body);

  // ↓ STEP 4: Find initial click
  const initialClick = await this.prisma.click.findUnique({
    where: { id: data.clickId },
    include: { user: true },
  });
  if (!initialClick) throw new NotFoundException('Click not found');

  // ↓ STEP 5: Geo inconsistency check
  await this.fraudService.checkGeoInconsistency(initialClick.userId, initialClick.id, postbackIp);

  // ↓ STEP 6: Re-calculate risk score
  await this.fraudService.calculateAndApplyRisk(
    initialClick.userId,
    postbackIp,
    initialClick.deviceFingerprint,
  );

  // Check if user was suspended by fraud check
  const reloadedUser = await this.prisma.user.findUnique({
    where: { id: initialClick.userId },
  });
  if (reloadedUser.status === 'SUSPENDED') {
    throw new BadRequestException('Conversion rejected: account suspended');
  }

  // ↓ STEP 7: Atomically convert click and credit wallet
  return this.prisma.$transaction(async (tx) => {
    const click = await tx.click.findUnique({
      where: { id: data.clickId },
      include: { offer: true, user: { select: { id: true, referredById: true, status: true } } },
    });

    if (!click) throw new NotFoundException('Click not found');
    
    // Prevent double conversion
    if (click.status !== ClickStatus.CLICKED) {
      throw new ConflictException('Click already processed');
    }

    // Update click status
    await tx.click.update({
      where: { id: data.clickId },
      data: { status: ClickStatus.CONVERTED },
    });

    const reward = click.offer.rewardAmount;

    // Credit user's pending balance
    await tx.wallet.update({
      where: { userId: click.userId },
      data: { pendingBalance: { increment: reward } },
    });

    // Create transaction record
    const userTx = await tx.transaction.create({
      data: {
        userId: click.userId,
        type: TransactionType.OFFER_CONVERSION,
        amount: reward,
        status: TransactionStatus.PENDING,
        clickId: click.id,
        notes: `Offer: ${click.offer.name}`,
      },
    });

    // Handle referral bonus (10%)
    if (click.user.referredById) {
      const referralBonus = reward.mul(0.10);
      await tx.wallet.update({
        where: { userId: click.user.referredById },
        data: { availableBalance: { increment: referralBonus } },
      });
      await tx.transaction.create({
        data: {
          userId: click.user.referredById,
          type: TransactionType.REFERRAL_BONUS,
          amount: referralBonus,
          status: TransactionStatus.COMPLETED,
          notes: `Referral from user ${click.userId.substring(0, 8)}`,
        },
      });
    }

    return { success: true, transactionId: userTx.id, reward: reward.toNumber() };
  });
}
```

### Response
```json
{
  "success": true,
  "transactionId": "uuid",
  "reward": 0.9
}
```

---

## Provider Signature Schemes

### 1. CPX Research (HMAC-SHA256)
```typescript
// backend/src/offers/providers/cpx.provider.ts
async validatePostback(query, headers, body): Promise<boolean> {
  const { click_id, payout, status, signature } = query;
  
  // Required fields
  if (!click_id || !payout || !signature) return false;

  // Signature: HMAC-SHA256("click_id:payout:status", CPX_SECRET)
  const computedSignature = crypto
    .createHmac('sha256', this.secret)
    .update(`${click_id}:${payout}:${status}`)
    .digest('hex');

  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(computedSignature),
    Buffer.from(signature),
  );
}

extractPostbackData(query, body): PostbackData {
  return {
    clickId: query.click_id,
    payout: parseFloat(query.payout),
    externalStatus: query.status,
  };
}
```

### 2. OfferToro (MD5)
```typescript
// backend/src/offers/providers/offertoro.provider.ts
async validatePostback(query, headers, body): Promise<boolean> {
  const { click_id, payout, o_id, sig } = query;
  
  if (!click_id || !payout || !o_id || !sig) return false;

  // Signature: MD5("o_id:click_id:OFFERTORO_SECRET")
  const hash = crypto.createHash('md5');
  const computedSignature = hash
    .update(`${o_id}:${click_id}:${this.secret}`)
    .digest('hex');

  return sig.toLowerCase() === computedSignature.toLowerCase();
}
```

### 3. Generic Provider (Token)
```typescript
// backend/src/offers/providers/generic.provider.ts
async validatePostback(query, headers, body): Promise<boolean> {
  const { click_id, payout, token } = query;
  
  if (!click_id || !payout || !token) return false;

  return token === this.secretToken;
}
```

---

## Anti-Exploit Measures

### 1. Double Conversion Prevention
```typescript
// Critical: Check click status before processing
if (click.status !== ClickStatus.CLICKED) {
  throw new ConflictException('Click already processed');
}
```

### 2. Click ID Uniqueness
- Click ID = UUID v4 (guaranteed unique)
- Used as primary key in Click table
- Only one Transaction can reference a Click (unique constraint)

### 3. Signature Validation
- Each provider has unique signature scheme
- Secrets stored in environment variables
- Timing-safe comparison for HMAC

### 4. Fraud Checks
- VPN detection on click creation
- Geo inconsistency check on postback
- Velocity check on both click and postback
- Device fingerprint clone detection

---

## Target URL Format

### CPX Research
```
Mock:   http://localhost:4000/api/offers/cpx/mock?click_id={click_id}
Real:   https://cpxresearch.com/offer/123?subid={click_id}
```

### OfferToro
```
Mock:   http://localhost:4000/api/offers/offertoro/mock?click_id={click_id}
Real:   https://offertoro.com/offer/456?sid={click_id}
```

### Generic
```
Mock:   http://localhost:4000/api/offers/generic/mock?click_id={click_id}
Real:   https://generic.com/survey/789?user={click_id}
```

---

## Testing Postback Flow

### Using Mock Providers
```bash
# 1. Register and login
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# 2. Get offers
curl http://localhost/api/offers \
  -H "Authorization: Bearer <token>"

# 3. Click an offer
curl "http://localhost/api/tracking/click?offerId=<offer_id>" \
  -H "Authorization: Bearer <token>"

# Returns: { clickId: "<uuid>", targetUrl: "..." }

# 4. Simulate postback (CPX mock)
curl "http://localhost/api/tracking/postback/cpx?click_id=<clickId>&payout=1.2000&status=1&signature=<computed_hmac>"

# Returns: { success: true, reward: 0.90 }
```

### Computing Mock Signatures
```typescript
// For CPX mock testing
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', 'cpx_secret_key_123456')
  .update(`${clickId}:${payout}:${status}`)
  .digest('hex');
console.log(signature);
```

---

## Performance Considerations

### Database Indexes
```sql
-- Critical for postback lookup
CREATE INDEX idx_click_id ON clicks(id);  -- PK, already exists

-- Critical for velocity check
CREATE INDEX idx_click_user_created ON clicks(user_id, created_at DESC);
```

### Scaling Postback Endpoint
```typescript
// Postback endpoint must handle high throughput
// Strategies:
// 1. No session/auth middleware (lightweight)
// 2. Async signature validation
// 3. Connection pooling for database
// 4. Redis cache for recent click lookups (PLANNED)
// 5. Background job queue for wallet credits (PLANNED)
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*