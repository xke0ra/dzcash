# Module Map - DZCASH

> **Purpose**: Complete module dependency graph and ownership for AI agents.

---

## Module Dependency Graph

```mermaid
graph TD
    App[AppModule] --> Config[ConfigModule]
    App --> Prisma[PrismaModule]
    App --> Auth[AuthModule]
    App --> Users[UsersModule]
    App --> Wallet[WalletModule]
    App --> Offers[OffersModule]
    App --> Tracking[TrackingModule]
    App --> Fraud[FraudModule]
    App --> Admin[AdminModule]

    Auth --> Prisma
    Auth --> Jwt[JwtModule]
    Auth --> Passport[PassportModule]

    Users --> Prisma
    Users --> Auth

    Wallet --> Prisma
    Wallet -> Users

    Offers --> Prisma
    Offers --> Cpx[CpxProvider]
    Offers --> OT[OfferToroProvider]
    Offers --> Gen[GenericProvider]

    Tracking --> Prisma
    Tracking --> Wallet
    Tracking --> Offers
    Tracking --> Fraud
    Tracking --> Auth

    Fraud --> Prisma
    Fraud --> Users

    Admin --> Prisma
    Admin --> Users
    Admin --> Wallet
    Admin --> Offers
    Admin --> Fraud
```

---

## Module Specifications

### 1. AuthModule
```
Path:        backend/src/auth/
Purpose:     Authentication, registration, session management
Imports:     PrismaModule, JwtModule, PassportModule
Exports:     AuthService, JwtAuthGuard
Controllers: AuthController (/api/auth)
Providers:   AuthService, JwtStrategy

Endpoints:
  POST /api/auth/register   - User registration with optional referral
  POST /api/auth/login      - Login, returns access + refresh tokens
  POST /api/auth/refresh    - Rotate refresh token
  POST /api/auth/logout     - Invalidate session

DTOs:
  register.dto.ts  - { email, password, referredByCode? }
  login.dto.ts     - { email, password }

Guards:
  jwt-auth.guard.ts  - Validates JWT access token

Strategies:
  jwt.strategy.ts    - Extracts user from JWT payload
```

### 2. UsersModule
```
Path:        backend/src/users/
Purpose:     User profile, referral management
Imports:     PrismaModule, AuthModule (for guards)
Exports:     UsersService
Controllers: UsersController (/api/users)
Providers:   UsersService

Endpoints:
  GET /api/users/me        - Current user profile (with wallet)
  GET /api/users/referrals - List referred users
```

### 3. WalletModule
```
Path:        backend/src/wallet/
Purpose:     Balance management, transactions, withdrawals
Imports:     PrismaModule
Exports:     WalletService
Controllers: WalletController (/api/wallet)
Providers:   WalletService

Endpoints:
  GET  /api/wallet/balance       - Pending + available balance
  GET  /api/wallet/transactions  - Transaction history
  GET  /api/wallet/withdrawals   - Withdrawal history
  POST /api/wallet/withdraw      - Request withdrawal

DTOs:
  withdraw.dto.ts  - { method, amount, details }

Key Methods:
  getBalance(userId)
  getTransactions(userId)
  getWithdrawals(userId)
  creditPending(userId, amount, clickId?, notes?)
  settleTransaction(transactionId)
  reverseTransaction(transactionId)
  requestWithdrawal(userId, dto)
  approveWithdrawal(withdrawalId)
  rejectWithdrawal(withdrawalId)
```

### 4. OffersModule
```
Path:        backend/src/offers/
Purpose:     Offer management, provider integration
Imports:     PrismaModule
Exports:     OffersService, CpxProvider, OfferToroProvider, GenericProvider
Controllers: OffersController (/api/offers)
Providers:   OffersService, CpxProvider, OfferToroProvider, GenericProvider

Endpoints:
  GET /api/offers  - List active offers

Providers:
  offer-provider.interface.ts  - PostbackData, OfferProviderInterface
  cpx.provider.ts              - HMAC-SHA256 validation
  offertoro.provider.ts        - MD5 validation
  generic.provider.ts          - Token validation

Key Methods:
  OffersService
  - getOffers(): list active offers
  - getOfferById(id): single offer
  - seedMockOffers(): initial seed data

  CpxProvider
  - getProviderName(): 'CPX'
  - validatePostback(query, headers, body): boolean
  - extractPostbackData(query, body): PostbackData

  OfferToroProvider
  - getProviderName(): 'OFFERTORO'
  - validatePostback(query, headers, body): boolean
  - extractPostbackData(query, body): PostbackData

  GenericProvider
  - getProviderName(): 'GENERIC'
  - validatePostback(query, headers, body): boolean
  - extractPostbackData(query, body): PostbackData
```

### 5. TrackingModule
```
Path:        backend/src/tracking/
Purpose:     Click tracking, postback handling, fraud integration
Imports:     PrismaModule, WalletModule, OffersModule, FraudModule, AuthModule
Exports:     TrackingService
Controllers: TrackingController (/api/tracking)
Providers:   TrackingService

Endpoints:
  GET  /api/tracking/click?offerId=xxx    - Register click (JWT)
  GET  /api/tracking/postback/:provider   - S2S postback (GET)
  POST /api/tracking/postback/:provider   - S2S postback (POST)

Key Methods:
  createClick(userId, offerId, ip, userAgent, fingerprint?)
    - Fraud check -> Create click -> Return redirect URL

  handlePostback(provider, query, headers, body, ip)
    - Get adapter -> Validate signature -> Extract data
    - Fraud check -> Atomic conversion -> Referral bonus
```

### 6. FraudModule
```
Path:        backend/src/fraud/
Purpose:     Fraud detection, risk scoring, automatic penalties
Imports:     PrismaModule, UsersModule
Exports:     FraudService
Controllers: FraudController (/api/fraud)
Providers:   FraudService

Endpoints:
  (Internal - called by TrackingService)

Key Methods:
  calculateAndApplyRisk(userId, ip, deviceFingerprint?): number
    - VPN check (+45)
    - Device clone check (+25 per clone, max +50)
    - Velocity check (+30 if >15/5min)
    - Update user riskScore and status

  checkGeoInconsistency(userId, clickId, postbackIp): boolean
    - Compare click IP with postback IP
    - Flag if different subnets (+40)
```

### 7. AdminModule
```
Path:        backend/src/admin/
Purpose:     Administration, user management, moderation
Imports:     PrismaModule, UsersModule, WalletModule, OffersModule, FraudModule
Exports:     AdminService
Controllers: AdminController (/api/admin)
Providers:   AdminService

Endpoints: (PLANNED - currently empty)
  GET    /api/admin/stats                   - Dashboard KPIs
  GET    /api/admin/users                   - User list (paginated)
  PATCH  /api/admin/users/:id/status        - Suspend/Activate/Freeze
  GET    /api/admin/offers                  - Offer list
  POST   /api/admin/offers                  - Create offer
  PATCH  /api/admin/offers/:id              - Update offer
  GET    /api/admin/withdrawals             - Withdrawal queue
  POST   /api/admin/withdrawals/:id/approve - Approve withdrawal
  POST   /api/admin/withdrawals/:id/reject  - Reject withdrawal
  GET    /api/admin/fraud                   - Fraud logs
  POST   /api/admin/fraud/:id/review        - Review fraud case

Key Methods: (PLANNED)
  getDashboardStats()
  getUsers(filter, pagination)
  updateUserStatus(id, status, reason)
  approveWithdrawal(id)
  rejectWithdrawal(id, reason)
  getFraudQueue()
  reviewFraudLog(id, action, notes)
```

### 8. PrismaModule
```
Path:        backend/src/prisma/
Purpose:     Database service provider
Imports:     (none, global module)
Exports:     PrismaService
Providers:   PrismaService

Key Methods:
  onModuleInit(): connect to database
  enableShutdownHooks(app): graceful shutdown
```

---

## Cross-Module Communication

### Direct Service Injection (DI)
```
TrackingService -> WalletService (creditPending)
TrackingService -> FraudService (calculateAndApplyRisk)
TrackingService -> CpxProvider (validatePostback)
TrackingService -> OfferToroProvider (validatePostback)
TrackingService -> GenericProvider (validatePostback)

WalletService -> UsersService (getUserStatus) [PLANNED]
AdminService   -> WalletService (approveWithdrawal) [PLANNED]
AdminService   -> FraudService (reviewFraudLog) [PLANNED]
AdminService   -> OffersService (create/update offer) [PLANNED]
```

### Event Bus (PLANNED)
```
PostbackProcessedEvent -> NotificationService (send email)
WithdrawalApprovedEvent -> NotificationService (send email)
FraudDetectedEvent -> AdminService (notify admin)
UserSuspendedEvent -> AuditService (log)
```

---

## Module Development Checklist

When creating a NEW module:
```
[ ] Create folder: backend/src/<module>/
[ ] Create: <module>.module.ts
[ ] Create: <module>.service.ts
[ ] Create: <module>.controller.ts (if has endpoints)
[ ] Create: dto/ (if has endpoints)
[ ] Create: guards/ (if has custom auth)
[ ] Register in AppModule
[ ] Export needed providers
[ ] Add tests
[ ] Update this MODULE_MAP.md
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*