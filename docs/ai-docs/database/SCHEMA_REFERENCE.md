# Database Schema Reference - DZCASH

> **Purpose**: Complete reference for all database models, enums, relations, and constraints.

---

## Entity Relationship Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  User                                       │
│  id (PK, UUID) │ email (UQ) │ passwordHash │ referralCode (UQ) │           │
│  referredById (FK→User) │ status (Enum) │ riskScore (Float) │ created/updated │
└────────┬──────────────┬──────────────┬──────────────┬──────────────────────┘
         │              │              │              │
         │ 1:1          │ 1:N          │ 1:N          │ 1:N
         ▼              ▼              ▼              ▼
   ┌─────────┐   ┌──────────┐   ┌────────────┐   ┌──────────────┐
   │ Wallet  │   │ Session  │   │   Click    │   │  Withdrawal  │
   ├─────────┤   ├──────────┤   ├────────────┤   ├──────────────┤
   │userId(FK│   │userId(FK)│   │userId(FK)  │   │userId(FK)    │
   │UQ)      │   │refreshTok│   │offerId(FK) │   │method (Enum) │
   │pending  │   │(UQ)      │   │ip          │   │amount (Dec)  │
   │available│   │expiresAt │   │userAgent   │   │details (JSON)│
   └─────────┘   └──────────┘   │fingerprint  │   │status (Enum) │
                                │status (Enum)│   │processedAt   │
                                └──────┬─────┘   └──────────────┘
                                       │ 1:1           │ 1:1
                                       ▼               ▼
                                 ┌─────────────┐  ┌─────────────┐
                                 │ Transaction │  │ Transaction │
                                 ├─────────────┤  ├─────────────┤
                                 │userId (FK)  │  │withdrawalId │
                                 │type (Enum)  │  │(FK, UQ)     │
                                 │amount (Dec) │  │clickId      │
                                 │status (Enum)│  │(FK, UQ)     │
                                 │notes (Text) │  └─────────────┘
                                 └─────────────┘
                                            │ 1:N
                                            ▼
                                      ┌──────────┐
                                      │ FraudLog │
                                      ├──────────┤
                                      │userId(FK)│
                                      │clickId(FK)│
                                      │triggerTyp│
                                      │score     │
                                      │details   │
                                      └──────────┘

┌──────────────────────────────────────┐
│               Offer                   │
│  id (PK, UUID) │ provider (Enum)      │
│  providerId (String) │ name           │
│  description │ payoutAmount (Dec)     │
│  rewardAmount (Dec) │ status (Bool)   │
│  targetUrl │ created/updated          │
│  UNIQUE(provider, providerId)         │
└────────────────┬─────────────────────┘
                 │ 1:N
                 ▼
           ┌──────────┐
           │  Click   │
           │offerId(FK)│
           └──────────┘
```

---

## Full Model Specifications

### 1. User
```prisma
model User {
  id               String         @id @default(uuid())
  email            String         @unique
  passwordHash     String
  referralCode     String         @unique
  referredById     String?
  referredBy       User?          @relation("UserReferrals", fields: [referredById], references: [id])
  referrals        User[]         @relation("UserReferrals")
  status           UserStatus     @default(ACTIVE)
  role             UserRole       @default(USER)     // PLANNED
  riskScore        Float          @default(0.0)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  
  wallet           Wallet?
  sessions         Session[]
  clicks           Click[]
  transactions     Transaction[]
  withdrawals      Withdrawal[]
  fraudLogs        FraudLog[]
  kycDocuments     KycDocument[]  // PLANNED
  notifications    Notification[] // PLANNED

  @@index([status])
  @@index([riskScore])
  @@index([createdAt])
}
```

**Key Constraints:**
- `email`: Unique, valid email format
- `referralCode`: Unique, 6-char uppercase alphanumeric
- `referredById`: Self-referential (tree structure for referrals)

**Indexes:**
- `status`: For filtering active/suspended users
- `riskScore`: For sorting by risk level
- `createdAt`: For date-range queries

### 2. Session
```prisma
model Session {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshToken String   @unique
  expiresAt    DateTime
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}
```

**Key Constraints:**
- `refreshToken`: Unique (fast lookup on refresh)
- `expiresAt`: Sessions auto-expire after 7 days

**Indexes:**
- `userId`: For finding all user sessions
- `expiresAt`: For cleanup cron job

### 3. Wallet
```prisma
model Wallet {
  id               String   @id @default(uuid())
  userId           String   @unique
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  pendingBalance   Decimal  @default(0.00) @db.Decimal(12, 4)
  availableBalance Decimal  @default(0.00) @db.Decimal(12, 4)
  updatedAt        DateTime @updatedAt
}
```

**Key Constraints:**
- `userId`: Unique (one wallet per user)
- `pendingBalance`: Decimal(12,4) - max 999,999,999.9999
- `availableBalance`: Decimal(12,4)

**Invariants:**
- `availableBalance` must never be negative
- `pendingBalance` must never be negative
- All updates via `$transaction` with `increment`/`decrement`

### 4. Offer
```prisma
model Offer {
  id            String        @id @default(uuid())
  provider      OfferProvider
  providerId    String        // Remote offer ID inside the network
  name          String
  description   String
  payoutAmount  Decimal       @db.Decimal(10, 4) // Advertiser pays us
  rewardAmount  Decimal       @db.Decimal(10, 4) // We pay user
  status        Boolean       @default(true)
  targetUrl     String        // URL with {click_id} macro
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  clicks        Click[]

  @@unique([provider, providerId])
  @@index([provider, status])
}
```

**Key Constraints:**
- `@@unique([provider, providerId])`: Ensures no duplicate offers from same provider
- `payoutAmount > rewardAmount`: Platform must make profit (validated in service)

**Indexes:**
- `[provider, status]`: For provider-specific active offer queries

### 5. Click
```prisma
model Click {
  id                String       @id @default(uuid()) // click_id for postback
  userId            String
  user              User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  offerId           String
  offer             Offer        @relation(fields: [offerId], references: [id])
  ip                String
  userAgent         String
  country           String?      // Derived from IP (PLANNED)
  deviceFingerprint String?
  status            ClickStatus  @default(CLICKED)
  createdAt         DateTime     @default(now())
  transaction       Transaction?

  @@index([userId, createdAt])
  @@index([offerId, status])
  @@index([deviceFingerprint])
}
```

**Key Constraints:**
- `id`: This is the `click_id` sent to advertiser and returned in postback
- `status`: Only `CLICKED` clicks can be converted (prevents double-spend)

**Indexes:**
- `[userId, createdAt]`: For velocity checks (recent clicks by user)
- `[offerId, status]`: For offer completion statistics
- `[deviceFingerprint]`: For clone detection

### 6. Transaction
```prisma
model Transaction {
  id           String            @id @default(uuid())
  userId       String
  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  type         TransactionType
  amount       Decimal           @db.Decimal(12, 4)
  status       TransactionStatus @default(PENDING)
  clickId      String?           @unique
  click        Click?            @relation(fields: [clickId], references: [id])
  withdrawalId String?           @unique
  withdrawal   Withdrawal?       @relation(fields: [withdrawalId], references: [id])
  notes        String?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  @@index([userId, type, status])
  @@index([createdAt])
}
```

**Audit Trail:**
Every balance change has a corresponding Transaction record (immutable after creation).

**Key Constraints:**
- `clickId`: Unique (one transaction per click conversion)
- `withdrawalId`: Unique (one transaction per withdrawal)
- Status transitions: PENDING -> COMPLETED | REVERSED | REJECTED

**Indexes:**
- `[userId, type, status]`: For user transaction history
- `[createdAt]`: For date-range analytics

### 7. Withdrawal
```prisma
model Withdrawal {
  id           String           @id @default(uuid())
  userId       String
  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  method       WithdrawalMethod
  status       WithdrawalStatus @default(PENDING)
  amount       Decimal          @db.Decimal(12, 4)
  details      Json             // Method-specific details
  processedAt  DateTime?
  createdAt    DateTime         @default(now())
  transaction  Transaction?

  @@index([userId, status])
  @@index([status, createdAt])
}
```

**`details` JSON Structure by Method:**
```json
// PAYPAL
{ "email": "user@example.com", "fullName": "John Doe" }

// CRYPTO (PLANNED)
{ "address": "0x...", "network": "TRC20", "currency": "USDT" }

// GIFT_CARD (PLANNED)
{ "type": "AMAZON", "value": 25, "currency": "USD" }
```

**Indexes:**
- `[userId, status]`: For user withdrawal history
- `[status, createdAt]`: For admin withdrawal queue

### 8. FraudLog
```prisma
model FraudLog {
  id          String           @id @default(uuid())
  userId      String
  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  clickId     String?
  triggerType FraudTriggerType
  score       Float
  details     Json
  createdAt   DateTime         @default(now())

  @@index([userId, createdAt])
  @@index([triggerType])
}
```

**`details` JSON Examples:**
```json
// VPN_DETECTED
{ "ip": "127.0.0.9", "detectionMethod": "mock", "score": 45 }

// DEVICE_FINGERPRINT_CLONE
{ "deviceFingerprint": "abc123", "duplicateAccountsCount": 3, "score": 50 }

// HIGH_VELOCITY
{ "clicksInLast5Min": 18, "threshold": 15, "score": 30 }

// GEO_INCONSISTENCY
{ "clickIp": "192.168.1.1", "postbackIp": "10.0.0.1", "score": 40 }
```

**Indexes:**
- `[userId, createdAt]`: For user fraud history
- `[triggerType]`: For fraud statistics

### 9. KycDocument (PLANNED)
```prisma
model KycDocument {
  id         String         @id @default(uuid())
  userId     String
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  type       KycDocumentType // PASSPORT | ID_CARD | UTILITY_BILL
  fileUrl    String         // URL to stored document
  status     KycStatus      @default(PENDING) // PENDING | APPROVED | REJECTED
  reviewedBy String?        // Admin who reviewed
  reviewedAt DateTime?
  notes      String?
  createdAt  DateTime       @default(now())

  @@index([userId, status])
}
```

### 10. Notification (PLANNED)
```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  title     String
  message   String
  data      Json?    // Additional context
  readAt    DateTime?
  createdAt DateTime @default(now())

  @@index([userId, readAt, createdAt])
}
```

---

## Enums Reference

### UserStatus
```typescript
enum UserStatus {
  ACTIVE    // Normal operation
  SUSPENDED // Full lockout (score >= 85)
  FROZEN    // Wallet frozen (score >= 70)
}
```

### UserRole (PLANNED)
```typescript
enum UserRole {
  USER        // Regular user
  ADMIN       // Can access admin panel
  SUPER_ADMIN // Full system access
}
```

### OfferProvider
```typescript
enum OfferProvider {
  CPX       // CPX Research
  OFFERTORO // OfferToro
  GENERIC   // Generic provider
}
```

### ClickStatus
```typescript
enum ClickStatus {
  CLICKED    // User clicked, pending conversion
  CONVERTED  // Postback received, conversion credited
  REJECTED   // Postback rejected (fraud/error)
}
```

### TransactionType
```typescript
enum TransactionType {
  OFFER_CONVERSION  // User completed an offer
  WITHDRAWAL        // User requested payout
  REFERRAL_BONUS    // Referrer commission (10%)
  FRAUD_REVERSAL    // Chargeback/fraud reversal
}
```

### TransactionStatus
```typescript
enum TransactionStatus {
  PENDING   // Awaiting settlement or approval
  COMPLETED // Successfully processed
  REVERSED  // Fraud chargeback
  REJECTED  // Withdrawal rejected
}
```

### WithdrawalMethod
```typescript
enum WithdrawalMethod {
  PAYPAL     // PayPal email
  CRYPTO     // Crypto wallet (PLANNED)
  GIFT_CARD  // Digital gift card (PLANNED)
}
```

### WithdrawalStatus
```typescript
enum WithdrawalStatus {
  PENDING  // Awaiting admin approval
  APPROVED // Approved, being processed
  REJECTED // Rejected, funds refunded
  FAILED   // Processing failed (PLANNED)
}
```

### FraudTriggerType
```typescript
enum FraudTriggerType {
  VPN_DETECTED             // VPN/Proxy IP detected
  IP_MISMATCH              // IP doesn't match expected
  HIGH_VELOCITY            // Too many clicks in short time
  DEVICE_FINGERPRINT_CLONE // Same device on multiple accounts
  GEO_INCONSISTENCY        // Click IP != postback IP country
}
```

---

## Required Indexes (Performance)

```sql
-- User table
CREATE INDEX idx_user_status ON users(status);
CREATE INDEX idx_user_risk_score ON users(risk_score);
CREATE INDEX idx_user_created_at ON users(created_at);

-- Session table
CREATE INDEX idx_session_user_id ON sessions(user_id);
CREATE INDEX idx_session_expires_at ON sessions(expires_at);

-- Click table
CREATE INDEX idx_click_user_created ON clicks(user_id, created_at DESC);
CREATE INDEX idx_click_offer_status ON clicks(offer_id, status);
CREATE INDEX idx_click_fingerprint ON clicks(device_fingerprint);

-- Transaction table
CREATE INDEX idx_tx_user_type_status ON transactions(user_id, type, status);
CREATE INDEX idx_tx_created_at ON transactions(created_at);

-- Withdrawal table
CREATE INDEX idx_withdrawal_user_status ON withdrawals(user_id, status);
CREATE INDEX idx_withdrawal_status_created ON withdrawals(status, created_at);

-- FraudLog table
CREATE INDEX idx_fraud_user_created ON fraud_logs(user_id, created_at DESC);
CREATE INDEX idx_fraud_trigger_type ON fraud_logs(trigger_type);

-- Offer table
CREATE INDEX idx_offer_provider_status ON offers(provider, status);
```

---

## Migration Rules

```bash
# ALWAYS follow this process:
cd backend

# 1. Make changes in schema.prisma
# 2. Generate migration
npx prisma migrate dev --name <description>

# 3. Generate Prisma Client
npx prisma generate

# 4. Commit both schema.prisma AND migration files
# NEVER delete migration files
# NEVER modify database directly
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*