# System Architecture - DZCASH

> **Purpose**: Complete system architecture documentation for AI agents.

---

## High-Level Architecture

```
                    Client Browser
                         |
                    [Next.js Frontend]
                    port: 3000 (internal)
                         |
                    [Nginx Reverse Proxy]
                    port: 80 (public)
                    /api/* -> Backend
                    /*     -> Frontend
                         |
              ┌──────────┴──────────┐
              |                      |
     [NestJS Backend]          [Next.js Frontend]
     port: 4000 (internal)     port: 3000 (internal)
              |
    ┌─────────┴─────────┐
    |                    |
[PostgreSQL 15]      [Redis 7]
   port: 5432           port: 6379
```

**Infrastructure**: Docker Compose with 5 services (PostgreSQL, Redis, Backend, Frontend, Nginx).

---

## Request Lifecycle

### 1. Authenticated API Request
```
Client -> Nginx (80) -> /api/* -> Backend (4000)
                                    |
                              [JwtAuthGuard]
                              (Validate JWT token)
                                    |
                              [Controller]
                              (Parse request, validate DTO)
                                    |
                              [Service]
                              (Business logic, Prisma queries)
                                    |
                              [Prisma] -> PostgreSQL
                                    |
                              Response -> Nginx -> Client
```

### 2. Offer Click Tracking Flow
```
Client -> Nginx (80) -> /api/tracking/click?offerId=xxx
                                    |
                              JwtAuthGuard (Validates user)
                                    |
                              TrackingController
                                    |
                              TrackingService.createClick()
                              - Fraud check: VPN, velocity, fingerprint
                              - Create Click record (CLICKED)
                              - Replace {click_id} in targetUrl
                                    |
                              Return: { clickId, targetUrl }
                                    |
                              Client opens targetUrl in new tab
```

### 3. S2S Postback Flow (from Advertiser)
```
Advertiser Server -> /api/tracking/postback/:provider
                      query: click_id, payout, signature
                                    |
                              TrackingController
                              (GET or POST, no auth - uses signature)
                                    |
                              TrackingService.handlePostback()
                              1. Get provider adapter (CPX/OfferToro/Generic)
                              2. Validate cryptographic signature
                              3. Extract postback data
                              4. Fraud checks: geo inconsistency, VPN
                              5. Atomic transaction:
                                 - Click -> CONVERTED
                                 - Wallet.pendingBalance += reward
                                 - Transaction created (PENDING)
                                 - If referred: referrer gets 10% (availableBalance)
                                    |
                              Return: { success: true, reward }
```

### 4. Withdrawal Flow
```
Client -> Nginx -> /api/wallet/withdraw
                   Body: { method, amount, details }
                                    |
                              JwtAuthGuard
                              WalletController
                                    |
                              WalletService.requestWithdrawal()
                              1. Verify user is not FROZEN/SUSPENDED
                              2. Check availableBalance >= amount
                              3. $transaction:
                                 - Deduct availableBalance
                                 - Create Withdrawal (PENDING)
                                 - Create Transaction (PENDING)
                                    |
                              Return: Withdrawal object
                                    |
               Admin reviews and approves/rejects via Admin Panel
```

---

## Module Architecture (Backend)

### Dependency Graph
```
AppModule
  ├── ConfigModule (global)
  ├── PrismaModule
  ├── AuthModule
  │     ├── JwtModule
  │     └── PassportModule
  ├── UsersModule
  │     └── AuthModule (for JWT)
  ├── WalletModule
  ├── OffersModule
  │     ├── CpxProvider
  │     ├── OfferToroProvider
  │     └── GenericProvider
  ├── TrackingModule
  │     ├── WalletModule
  │     ├── OffersModule
  │     └── FraudModule
  ├── FraudModule
  │     └── UsersModule
  └── AdminModule
        ├── UsersModule
        ├── WalletModule
        ├── OffersModule
        └── FraudModule
```

### Module Responsibilities

| Module | DI Providers | Exports | Key Classes |
|--------|-------------|---------|-------------|
| Auth | JwtStrategy | AuthService, JwtAuthGuard | AuthService, AuthController |
| Users | UsersService | UsersService | UsersService, UsersController |
| Wallet | WalletService | WalletService | WalletService, WalletController |
| Offers | OffersService, CpxProvider, OfferToroProvider, GenericProvider | All 4 | OffersService, OffersController |
| Tracking | TrackingService | TrackingService | TrackingService, TrackingController |
| Fraud | FraudService | FraudService | FraudService, FraudController |
| Admin | AdminService | - | AdminController |

---

## Authentication Architecture

### JWT Token System
```
Access Token:   15 min expiry
Refresh Token:  7 day expiry (stored in Session table)

Flow:
1. Login -> Generate access + refresh tokens
2. Refresh token stored in Session table (with IP + UserAgent)
3. Access token used for API calls (in Authorization header)
4. When access token expires -> /auth/refresh with refresh token
5. Refresh token rotated (old deleted, new created)
6. On logout -> Session deleted
```

### Token Payload
```typescript
// Access Token
{
  sub: userId,    // Subject = user ID
  email: string,  // User email
  iat: number,    // Issued at
  exp: number,    // Expiry (15 min)
}

// Refresh Token
{
  sub: userId,
  email: string,
  iat: number,
  exp: number,    // Expiry (7 days)
}
```

### Guards
```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Validates JWT access token from Authorization header
}

@Injectable()
export class AdminGuard implements CanActivate {
  // Checks if user has ADMIN role (planned: role-based)
  // Current: checks email against env ADMIN_EMAIL
}
```

---

## Fraud Detection Architecture

### Checkpoints
```
Click Creation:
  1. VPN/Proxy Detection (+45)
  2. Device Fingerprint Clones (+25 each, max +50)
  3. Click Velocity (+30 if >15 clicks/5min)

Postback Processing:
  4. Geo Inconsistency (+40 if click IP != postback IP subnet)
  5. Re-calculate all risks

Withdrawal Request:
  6. Check riskScore < 70 (otherwise FROZEN)
```

### Risk Score Thresholds
```
0-69:   ACTIVE    - No restrictions
70-84:  FROZEN    - No withdrawals, offers still work
85-100: SUSPENDED - No login, no activity, full lock
```

### FraudLog Schema
```typescript
FraudLog {
  id: UUID
  userId: UUID      // Who triggered the fraud
  clickId?: UUID    // Related click (if applicable)
  triggerType: FraudTriggerType  // VPN, CLONE, VELOCITY, GEO
  score: Float      // Penalty for this trigger
  details: JSON     // Context (IP, fingerprint, counts)
  createdAt: DateTime
}
```

---

## Wallet Architecture

### Dual Balance Model
```
Wallet {
  pendingBalance: Decimal(12,4)   // Awaiting admin settlement
  availableBalance: Decimal(12,4) // Ready for withdrawal
}

Balance Flow:
  Postback Verified -> pendingBalance += reward (PENDING)
  Admin Settles      -> pendingBalance -= reward
                     -> availableBalance += reward (COMPLETED)
  Withdrawal Request -> availableBalance -= amount (PENDING)
  Admin Approves     -> Withdrawal COMPLETED
  Admin Rejects      -> availableBalance += amount (REFUNDED)
  Fraud Reversal     -> availableBalance -= amount (REVERSED)
                     OR pendingBalance -= amount (REVERSED)
```

### Transaction Types
```
OFFER_CONVERSION: PENDING -> (settle) -> COMPLETED | (reverse) -> REVERSED
WITHDRAWAL:       PENDING -> (approve) -> COMPLETED | (reject) -> REJECTED
REFERRAL_BONUS:   COMPLETED (instant)
FRAUD_REVERSAL:   REVERSED (auto or manual)
```

---

## Offer Provider Architecture

### Strategy Pattern (Adapter)
```
OfferProviderInterface (interface)
  ├── CpxProvider (implements)
  │     - Signature: HMAC-SHA256(click_id:payout:status)
  │     - Timing-safe comparison
  │
  ├── OfferToroProvider (implements)
  │     - Signature: MD5(o_id:click_id:secret)
  │     - Case-insensitive hex comparison
  │
  └── GenericProvider (implements)
        - Signature: Pre-shared token
        - Direct string comparison
```

### Postback Validation Flow
```typescript
async handlePostback(provider, query, headers, body, ip) {
  // 1. Select adapter by provider name
  const adapter = this.getProvider(provider);
  
  // 2. Validate cryptographic signature
  const isValid = await adapter.validatePostback(query, headers, body);
  if (!isValid) throw BadRequestException('Invalid signature');
  
  // 3. Extract standardized data
  const data = adapter.extractPostbackData(query, body);
  
  // 4. Look up initial click
  const click = await prisma.click.findUnique({ where: { id: data.clickId } });
  
  // 5. Check click status (prevent double-processing)
  if (click.status !== 'CLICKED') throw ConflictException('Already processed');
  
  // 6. Fraud checks
  await this.fraudService.checkGeoInconsistency(...);
  await this.fraudService.calculateAndApplyRisk(...);
  
  // 7. Atomic conversion (transaction)
  await this.walletService.creditPending(...);
}
```

---

## Testing Architecture (Planned)

### Vitest (Unit Tests)
```
backend/src/
├── auth/auth.service.spec.ts
├── wallet/wallet.service.spec.ts
├── fraud/fraud.service.spec.ts
├── tracking/tracking.service.spec.ts
├── offers/offers.service.spec.ts
├── offers/providers/cpx.provider.spec.ts
├── offers/providers/offertoro.provider.spec.ts
└── prisma/prisma.service.spec.ts
```

### Playwright (E2E Tests)
```
e2e/
├── auth.flow.spec.ts
├── offer-click-postback.flow.spec.ts
├── wallet-withdrawal.flow.spec.ts
├── admin-panel.flow.spec.ts
├── fraud-detection.flow.spec.ts
└── referral-system.flow.spec.ts
```

### Test Fixtures
```
test/fixtures/
├── users.ts
├── offers.ts
├── clicks.ts
├── transactions.ts
├── withdrawals.ts
└── fraudLogs.ts
```

---

## Deployment Architecture

### Docker Compose Services
```
Services:
  postgres:15-alpine
    - Port: 5432
    - Volume: postgres_data
    - Health: pg_isready
  
  redis:7-alpine
    - Port: 6379
    - Volume: redis_data
  
  backend (NestJS)
    - Port: 4000
    - Depends on: postgres, redis
    - Build: multi-stage (builder -> runner)
    - CMD: prisma migrate deploy && node dist/main
  
  frontend (Next.js)
    - Port: 3000
    - Depends on: backend
    - Build: multi-stage (builder -> runner)
    - CMD: npm start
  
  nginx:alpine
    - Port: 80
    - Port: 443 (planned for SSL)
    - Config: nginx/default.conf
```

### Environment Separation
```yaml
# Development
  VPN_API_MOCK: true
  CORS: origin: '*'

# Production
  VPN_API_MOCK: false
  FRONTEND_URL: https://dzcash.com
  CORS: origin: 'https://dzcash.com'
  SSL: enabled
  Rate Limiting: enabled
```

---

## Performance Considerations

### Database Indexes (Required)
```sql
-- Critical indexes for performance
CREATE INDEX idx_clicks_user_created ON clicks(user_id, created_at DESC);
CREATE INDEX idx_clicks_offer_status ON clicks(offer_id, status);
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX idx_withdrawals_user_status ON withdrawals(user_id, status);
CREATE INDEX idx_fraud_logs_user ON fraud_logs(user_id, created_at DESC);
CREATE INDEX idx_offers_provider_status ON offers(provider, status);
```

### Caching Strategy (Planned)
```
Redis Cache:
  - Offer list: 5 min TTL
  - User profile: 15 min TTL
  - Wallet balance: 1 min TTL
  - IP reputation: 1 hour TTL
  - Rate limiting counters: 1 min TTL
```

---

## Monitoring & Observability (Planned)

### Logging (Pino)
```json
{
  "level": "info",
  "timestamp": "2026-07-02T10:00:00.000Z",
  "correlationId": "req-xxx",
  "service": "backend",
  "module": "tracking",
  "action": "postback_received",
  "provider": "CPX",
  "clickId": "uuid",
  "status": "success",
  "duration": 45,
  "userId": "uuid"
}
```

### Metrics (Prometheus)
```
http_requests_total{method, path, status}
http_request_duration_ms{method, path}
postbacks_total{provider, status}
clicks_total{status}
withdrawals_total{method, status}
fraud_alerts_total{trigger_type}
wallet_operations_total{type}
active_users_total
```

### Alerts
- Postback failure rate > 5% (critical)
- Error rate > 1% (warning)
- Withdrawal queue > 100 pending (info)
- DB connection pool > 80% (critical)
- Redis memory > 80% (warning)

---

## Security Architecture

### Defense Layers
```
Layer 1: Nginx
  - Rate limiting (planned)
  - SSL termination (planned)
  - Request size limits
  
Layer 2: NestJS
  - Helmet (security headers)
  - CORS validation
  - JWT authentication
  - AdminGuard for admin routes
  
Layer 3: Service Layer
  - Input validation (class-validator)
  - Fraud detection
  - Atomic transactions
  
Layer 4: Database
  - Prisma type safety
  - Row-level locking (transactions)
```

### Secrets Management
```bash
# Development: .env file
# Production: Docker secrets or vault
# NEVER: hardcoded in code or docker-compose.yml (production)
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*