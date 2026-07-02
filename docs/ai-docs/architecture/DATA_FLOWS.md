# Data Flows - DZCASH

> **Purpose**: Complete data flow documentation for business-critical operations.

---

## Flow 1: User Registration

```
Client                          Backend                         Database
  |                                |                               |
  | POST /api/auth/register        |                               |
  | { email, password, refCode }   |                               |
  |------------------------------->|                               |
  |                                |                               |
  |                          [AuthService.register]                |
  |                                |                               |
  |                          Check email uniqueness                |
  |                                |--------> User.findUnique ----->|
  |                                |<------- existing user ---------|
  |                                |                               |
  |                          Check referral code (if provided)     |
  |                                |--------> User.findUnique ----->|
  |                                |<------- referrer --------------|
  |                                |                               |
  |                          Generate unique referral code         |
  |                                |                               |
  |                          Hash password (bcrypt, cost: 10)      |
  |                                |                               |
  |                          Begin $transaction                    |
  |                                |------- User.create ----------->|
  |                                |------- Wallet.create --------->|
  |                                |------- commit -----------------|
  |                                |                               |
  | 201 { message, userId, email } |                               |
  |<-------------------------------|                               |
```

**Validation Rules:**
- Email: valid email format, unique in system
- Password: minimum 6 characters
- Referral code: optional, must exist if provided
- Referral code generation: random 6-char uppercase, ensure uniqueness

**Side Effects:**
- Wallet created with 0 balance
- If referred: referrer gets 10% commission on future conversions

---

## Flow 2: Offer Click -> Postback -> Conversion

```
Client              Backend               Advertiser           Database
  |                     |                     |                    |
  |--- Click Offer ---->|                     |                    |
  |  GET /tracking/click|                     |                    |
  |  ?offerId=xxx      |                     |                    |
  |                     |                     |                    |
  |              [TrackingService.createClick]|                    |
  |                     |                     |                    |
  |              Fraud Check:                  |                    |
  |              - VPN detection              |                    |
  |              - Device fingerprint clones  |                    |
  |              - Click velocity             |                    |
  |                     |                     |                    |
  |              Create Click (CLICKED)        |                    |
  |                     |-----------------------> Click.create ---->|
  |                     |                     |                    |
  |              Replace {click_id} in URL     |                    |
  |                     |                     |                    |
  |   { clickId,       |                     |                    |
  |     targetUrl }    |                     |                    |
  |<-------------------|                     |                    |
  |                     |                     |                    |
  |--- Open tab ------->|                     |                    |
  |  to targetUrl       |                     |                    |
  |                     |                     |                    |
  |              |----- User completes offer on advertiser site   |
  |              |      (survey, app install, signup)              |
  |              |                     |                           |
  |              |                     |                           |
  |              |    S2S Postback     |                           |
  |              |<--------------------|                           |
  |              |  GET/POST           |                           |
  |              |  /tracking/postback/|                           |
  |              |  :provider          |                           |
  |              |  ?click_id,payout,  |                           |
  |              |  signature          |                           |
  |              |                     |                           |
  |              | [TrackingService.handlePostback]                |
  |              |                     |                           |
  |              | 1. Get provider adapter                        |
  |              | 2. Validate signature                           |
  |              | 3. Extract data                                 |
  |              | 4. Look up click                                |
  |              |    |--------------------> Click.findUnique ---->|
  |              |    |<------------------- click + user ----------|
  |              |                     |                           |
  |              | 5. Fraud check: geo inconsistency              |
  |              | 6. Re-calculate risk score                     |
  |              |                     |                           |
  |              | 7. Begin $transaction                          |
  |              |    |--------------------> Click.update -------->|
  |              |    |  (CLICKED -> CONVERTED)                   |
  |              |    |--------------------> Wallet.update ------->|
  |              |    |  (pendingBalance += reward)               |
  |              |    |--------------------> Transaction.create -->|
  |              |    |  (PENDING)                                |
  |              |    |                    |                       |
  |              |    | IF referred:                              |
  |              |    |   10% to referrer's availableBalance       |
  |              |    |--------------------> Wallet.update ------->|
  |              |    |--------------------> Transaction.create -->|
  |              |    |  (REFERRAL_BONUS, COMPLETED)             |
  |              |                     |                           |
  |              | 8. Commit transaction                          |
  |              |                     |                           |
  |  200 {       |                     |                           |
  |   success,   |                     |                           |
  |   reward }   |                     |                           |
  |<-------------|                     |                           |
```

**Invariants:**
- Each click can only be converted once (status check prevents double-spend)
- Wallet updates use `increment`/`decrement` inside `$transaction` (prevents race conditions)
- Referral bonus is paid instantly to `availableBalance` (not pending)

---

## Flow 3: Withdrawal Lifecycle

```
Client              Backend                Admin               Database
  |                     |                     |                    |
  |--- Request Withdraw |                     |                    |
  |  POST /wallet/      |                     |                    |
  |  withdraw           |                     |                    |
  |  { method, amount,  |                     |                    |
  |    details }        |                     |                    |
  |-------------------->|                     |                    |
  |                     |                     |                    |
  |              [WalletService.requestWithdrawal]                 |
  |                     |                     |                    |
  |              1. Verify user NOT frozen/suspended               |
  |                     |                     |                    |
  |              2. Check availableBalance >= amount               |
  |                     |                     |                    |
  |              3. Begin $transaction                             |
  |                     |-----------------------> Wallet.find ---->|
  |                     |-----------------------> Wallet.update -->|
  |                     |  (availableBalance -= amount)            |
  |                     |-----------------------> Withdrawal ----->|
  |                     |  .create (PENDING)                      |
  |                     |-----------------------> Transaction ---->|
  |                     |  .create (WITHDRAWAL, PENDING)          |
  |                     |                     |                    |
  |  { withdrawal }    |                     |                    |
  |<--------------------|                     |                    |
  |                     |                     |                    |
  |              ===== WAITING FOR ADMIN =====                     |
  |                     |                     |                    |
  |                     |    Admin reviews     |                    |
  |                     |    withdrawal queue  |                    |
  |                     |<--------------------|                    |
  |                     |                     |                    |
  |                     |--- APPROVE ---------|                    |
  |                     |  POST /admin/        |                    |
  |                     |  withdrawals/:id/    |                    |
  |                     |  approve             |                    |
  |                     |                     |                    |
  |                     |  [WalletService.approveWithdrawal]        |
  |                     |                     |                    |
  |                     |  Begin $transaction                      |
  |                     |    |----------------> Withdrawal ------->|
  |                     |    |  .update (APPROVED, processedAt)    |
  |                     |    |----------------> Transaction ------->|
  |                     |    |  .update (COMPLETED)                |
  |                     |                     |                    |
  |                     |--- REJECT ----------|                    |
  |                     |  POST /admin/        |                    |
  |                     |  withdrawals/:id/    |                    |
  |                     |  reject              |                    |
  |                     |                     |                    |
  |                     |  [WalletService.rejectWithdrawal]         |
  |                     |                     |                    |
  |                     |  Begin $transaction                      |
  |                     |    |----------------> Wallet.update ----->|
  |                     |    |  (availableBalance += amount)       |
  |                     |    |----------------> Withdrawal -------->|
  |                     |    |  .update (REJECTED)                 |
  |                     |    |----------------> Transaction ------->|
  |                     |    |  .update (REJECTED)                 |
  |                     |                     |                    |
  |   Notification     |                     |                    |
  |   (PLANNED)        |                     |                    |
  |<--------------------|                     |                    |
```

**Withdrawal Methods:**
- PAYPAL: `details: { email: string }`
- CRYPTO: `details: { address: string, network: string }` (PLANNED)
- GIFT_CARD: `details: { type: string, value: number }` (PLANNED)

**Minimum Withdrawal:** $5.00 (configurable in env)

---

## Flow 4: Fraud Detection & Auto-Penalty

```
Trigger: Click Creation or Postback Processing
          |
          v
  [FraudService.calculateAndApplyRisk]
          |
          ├── 1. VPN/Proxy Detection
          |     Check ip in mock list (or external API)
          |     If VPN: score += 45, log FraudLog
          |
          ├── 2. Device Fingerprint Clones
          |     Count users with same fingerprint
          |     If clones > 1: score += min(clones * 25, 50)
          |
          ├── 3. Click Velocity
          |     Count clicks in last 5 minutes
          |     If > 15: score += 30
          |
          └── (Postback only) 4. Geo Inconsistency
                Compare click IP with postback IP
                If different subnet: score += 40
          |
          v
  Apply Risk Score
          |
          ├── score >= 85 -> SUSPENDED (full lockout)
          ├── score >= 70 -> FROZEN (no withdrawals)
          └── score < 70  -> ACTIVE (no change)
          |
          v
  Update User
  - riskScore = finalScore
  - status = statusUpdate
  |
  v
  Continue operation
  - If SUSPENDED: throw error, block operation
  - If FROZEN: allow offers but not withdrawals
  - If ACTIVE: allow all
```

**Scores At A Glance:**
```
VPN Detection:        +45
Device Clone:         +25 per clone (max +50)
High Velocity:        +30
Geo Inconsistency:    +40
--------------------------------------------------
Maximum possible:     165 (capped at 100)
SUSPENDED threshold:  85
FROZEN threshold:     70
```

---

## Flow 5: Admin Dashboard Data

```
Admin Browser             Backend                   Database
  |                          |                          |
  |--- GET /api/admin/stats  |                          |
  |------------------------->|                          |
  |                          |                          |
  |                   [AdminService.getDashboardStats]   |
  |                          |                          |
  |                   Parallel queries:                 |
  |                          |                          |
  |                   Total Users                       |
  |                          |------ User.count -------->|
  |                          |                          |
  |                   New Users (today)                  |
  |                          |------ User.count -------->|
  |                          |  (createdAt >= today)     |
  |                          |                          |
  |                   Total Offers Completed             |
  |                          |------ Click.count ------->|
  |                          |  (status: CONVERTED)     |
  |                          |                          |
  |                   Pending Withdrawals               |
  |                          |------ Withdrawal.count -->|
  |                          |  (status: PENDING)       |
  |                          |                          |
  |                   Total Payout (today)               |
  |                          |------ Transaction ------>|
  |                          |  .sum (withdrawal type)  |
  |                          |                          |
  |                   Active Users (fraud alerts)        |
  |                          |------ FraudLog.count --->|
  |                          |  (last 24h)             |
  |                          |                          |
  |                   Revenue (today)                   |
  |                          |------ Offer SUM -------->|
  |                          |  payout - reward         |
  |                          |                          |
  |   { stats: {             |                          |
  |     totalUsers,          |                          |
  |     newUsersToday,       |                          |
  |     offersCompleted,     |                          |
  |     pendingWithdrawals,  |                          |
  |     totalPayoutToday,    |                          |
  |     fraudAlertsToday,    |                          |
  |     revenue              |                          |
  |   } }                    |                          |
  |<-------------------------|                          |
```

---

## Flow 6: Session & Token Management

```
Client                  Backend                      Database
  |                        |                            |
  |--- Login ------------->|                            |
  |                        |                            |
  |                  Generate:                          |
  |                  - Access Token (15 min)            |
  |                  - Refresh Token (7 days)           |
  |                        |                            |
  |                  Store session                       |
  |                        |--- Session.create --------->|
  |                        |  { userId, refreshToken,   |
  |                        |    expiresAt, ip, agent }  |
  |                        |                            |
  |  200 { accessToken,   |                            |
  |        refreshToken,  |                            |
  |        user }         |                            |
  |<-----------------------|                            |
  |                        |                            |
  |--- API Call ---------->|                            |
  |  Authorization: Bearer |                            |
  |  accessToken           |                            |
  |                        |                            |
  |                  [JwtAuthGuard]                     |
  |                  Verify JWT signature               |
  |                  Check expiry (15 min)              |
  |                  Extract user from payload          |
  |                        |                            |
  |--- 15 min later ------ |                            |
  |--- /auth/refresh ----->|                            |
  |  { refreshToken }      |                            |
  |                        |                            |
  |                  Find session                        |
  |                        |--- Session.findUnique ---->|
  |                        |                            |
  |                  Check not expired                  |
  |                  Rotate token:                       |
  |                  - Delete old session               |
  |                  - Create new session               |
  |                  - Generate new tokens              |
  |                        |                            |
  |  200 { accessToken,   |                            |
  |        refreshToken } |                            |
  |<-----------------------|                            |
  |                        |                            |
  |--- Logout ------------>|                            |
  |  { refreshToken }      |                            |
  |                        |                            |
  |                  Delete session                      |
  |                        |--- Session.deleteMany ---->|
```

---

## Flow 7: Referral Bonus Processing

```
Postback processed for referred user
          |
          v
  Check: click.user.referredById !== null
          |
          v (if referred)
  Calculate bonus = reward * 0.10
          |
          v
  Begin $transaction (same transaction as main conversion)
          |
          ├── Wallet.update for referrer
          |     availableBalance += bonus
          |
          └── Transaction.create for referrer
                type: REFERRAL_BONUS
                status: COMPLETED (instant)
                notes: "Referral commission from user ..."
          |
          v
  Commit transaction
          |
          v
  Referrer sees updated balance on next dashboard load
```

**Key Characteristics:**
- Commission is 10% of user's reward (not advertiser's payout)
- Paid instantly to `availableBalance` (no pending period)
- Lifetime: referrer earns on all future conversions of referred user
- Stored in same atomic transaction as main conversion

---

## Flow 8: Offer Synchronization (PLANNED)

```
  [Cron Job]       Backend             Provider API         Database
     |                |                     |                  |
     |--- 3:00 AM --->|                     |                  |
     |                |                     |                  |
     |          [OffersSyncService]         |                  |
     |                |                     |                  |
     |          For each provider:          |                  |
     |                |                     |                  |
     |          Fetch active offers          |                  |
     |                |--- HTTP GET -------->|                  |
     |                |   /api/offers       |                  |
     |                |<--- offers[] -------|                  |
     |                |                     |                  |
     |          Transform to internal format |                  |
     |                |                     |                  |
     |          Upsert offers:               |                  |
     |          For each offer:              |                  |
     |                |                     |                  |
     |          Find by provider+providerId  |                  |
     |                |--- Offer.findUnique -|----------------->|
     |                |                     |                  |
     |          If exists:                   |                  |
     |          Update payout/reward/status  |                  |
     |                |--- Offer.update ---->|----------------->|
     |                |                     |                  |
     |          If new:                      |                  |
     |          Create offer                 |                  |
     |                |--- Offer.create ---->|----------------->|
     |                |                     |                  |
     |          If missing from provider:    |                  |
     |          Deactivate offer            |                  |
     |                |--- Offer.update ---->|----------------->|
     |                |  (status: false)    |                  |
     |                |                     |                  |
     |          Return SyncResult {          |                  |
     |            created, updated,          |                  |
     |            deactivated, errors       |                  |
     |          }                           |                  |
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*