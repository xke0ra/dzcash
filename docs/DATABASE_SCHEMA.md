# Database Schema: DZCASH

This document details the relational PostgreSQL database entities of the platform, managed via Prisma ORM.

---

## 🗄️ Database Tables (DDL Summary)

### 1. User
Stores user accounts, authentication references, and referral linkages.
- `id` (UUID): Primary Key
- `email` (String): Unique email
- `passwordHash` (String): Bcrypt hashed credentials
- `referralCode` (String): Unique 6-character referral code
- `referredById` (UUID, Nullable): References `User.id` (who invited this user)
- `status` (Enum: `ACTIVE`, `SUSPENDED`, `FROZEN`)
- `riskScore` (Float): Calculated security threat index (0-100)

### 2. Session
Tracks login sessions and JWT refresh tokens.
- `id` (UUID): Primary Key
- `userId`: References `User.id`
- `refreshToken` (String): Hashed rotation reference
- `expiresAt` (DateTime)
- `ipAddress` (String, Nullable)
- `userAgent` (String, Nullable)

### 3. Wallet
Sub-entry details containing balances. Updates run inside database row locks.
- `id` (UUID): Primary Key
- `userId`: References `User.id` (Unique)
- `pendingBalance` (Decimal, 12, 4): Payouts held for review
- `availableBalance` (Decimal, 12, 4): Confirmed payout tokens

### 4. Offer
Configured campaign networks.
- `id` (UUID): Primary Key
- `provider` (Enum: `CPX`, `OFFERTORO`, `GENERIC`)
- `providerId` (String): Remote ID inside network
- `name` (String)
- `description` (String)
- `payoutAmount` (Decimal, 10, 4): Advertisers payout to DZCASH
- `rewardAmount` (Decimal, 10, 4): Platform payout to User
- `targetUrl` (String): Click url macro wrapper

### 5. Click
Saves individual redirection instances, providing `click_id` verification.
- `id` (UUID): Primary Key (Maps to `click_id` parameter)
- `userId`: References `User.id`
- `offerId`: References `Offer.id`
- `ip` (String)
- `userAgent` (String)
- `deviceFingerprint` (String, Nullable)
- `status` (Enum: `CLICKED`, `CONVERTED`, `REJECTED`)

### 6. Transaction
Atomic double-entry ledger logs.
- `id` (UUID): Primary Key
- `userId`: References `User.id`
- `type` (Enum: `OFFER_CONVERSION`, `WITHDRAWAL`, `REFERRAL_BONUS`, `FRAUD_REVERSAL`)
- `amount` (Decimal, 12, 4)
- `status` (Enum: `PENDING`, `COMPLETED`, `REVERSED`, `REJECTED`)
- `clickId` (Nullable): References `Click.id`
- `withdrawalId` (Nullable): References `Withdrawal.id`

### 7. Withdrawal
Payment queues.
- `id` (UUID): Primary Key
- `userId`: References `User.id`
- `method` (Enum: `PAYPAL`, `CRYPTO`, `GIFT_CARD`)
- `status` (Enum: `PENDING`, `APPROVED`, `REJECTED`, `FAILED`)
- `amount` (Decimal, 12, 4)
- `details` (JSON): Destination credentials

### 8. FraudLog
Flagged suspicious behaviors.
- `id` (UUID): Primary Key
- `userId`: References `User.id`
- `triggerType` (Enum: `VPN_DETECTED`, `IP_MISMATCH`, etc.)
- `score` (Float): Individual rule weight penalty
- `details` (JSON): Trigger payload metadata
