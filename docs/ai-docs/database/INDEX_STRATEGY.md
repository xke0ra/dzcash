# Index Strategy - DZCASH

> **Purpose**: Database indexing strategy for optimal query performance under high load.

---

## Query Analysis by Module

### Auth Module
```
Queries:
1. User.findUnique({ where: { email } })
   - Index: email (unique) - EXISTS
   
2. User.findUnique({ where: { id } })
   - Index: id (PK) - EXISTS

3. Session.findUnique({ where: { refreshToken } })
   - Index: refreshToken (unique) - EXISTS

4. Session.findMany({ where: { userId } })
   - Recommended Index: idx_session_user_id

5. Session.deleteMany({ where: { expiresAt: { lt: date } } })
   - Recommended Index: idx_session_expires_at
```

### Wallet Module
```
Queries:
1. Wallet.findUnique({ where: { userId } })
   - Index: userId (unique) - EXISTS

2. Transaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
   - Recommended Index: idx_tx_user_created

3. Withdrawal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
   - Recommended Index: idx_withdrawal_user_created
```

### Offers Module
```
Queries:
1. Offer.findMany({ where: { status: true }, orderBy: { rewardAmount: 'desc' } })
   - Recommended Index: idx_offer_status_reward

2. Offer.findMany({ where: { provider, status: true } })
   - Recommended Index: idx_offer_provider_status
```

### Tracking Module
```
Queries:
1. Click.create({ data: { userId, offerId, ... } })
   - Uses PK and FKs

2. Click.findUnique({ where: { id } })
   - Index: id (PK) - EXISTS

3. Click.findMany({ where: { userId, createdAt: { gte: date } } })
   - RECOMMENDED: idx_click_user_created
   - Purpose: Velocity check in fraud detection
   - Type: Composite B-tree

4. Click.count({ where: { userId, createdAt: { gte: date } } })
   - Uses same index as above (index-only scan possible)

5. Click.findMany({ where: { offerId, status } })
   - RECOMMENDED: idx_click_offer_status
   - Purpose: Offer conversion statistics
```

### Fraud Module
```
Queries:
1. User.count({ where: { id: { not }, clicks: { some: { deviceFingerprint } } } })
   - RECOMMENDED: idx_click_fingerprint (partial)
   - Note: This query is complex and may be slow with many users
   - Consider: materialized view or caching for clone detection

2. Click.count({ where: { userId, createdAt: { gte: date } } })
   - Uses idx_click_user_created

3. User.update({ where: { id }, data: { riskScore, status } })
   - Index: id (PK) - EXISTS

4. FraudLog.create(...)
   - Standard insert
```

### Admin Module (PLANNED)
```
Queries:
1. User.findMany({ where: filters, orderBy, skip, take })
   - RECOMMENDED: Composite indexes matching filter patterns
   
2. Withdrawal.findMany({ where: { status: PENDING }, orderBy: { createdAt: 'asc' } })
   - RECOMMENDED: idx_withdrawal_status_created

3. Transaction.aggregate({ where: { createdAt: { gte: date } }, _sum: { amount } })
   - RECOMMENDED: idx_tx_created_at with type filter
```

---

## Recommended Indexes

```sql
-- ========== SESSION ==========
CREATE INDEX IF NOT EXISTS idx_session_user_id 
  ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_session_expires_at 
  ON sessions(expires_at);

-- ========== CLICK ==========
-- PRIMARY: Velocity checks + user history
CREATE INDEX IF NOT EXISTS idx_click_user_created 
  ON clicks(user_id, created_at DESC);

-- SECONDARY: Offer completion stats
CREATE INDEX IF NOT EXISTS idx_click_offer_status 
  ON clicks(offer_id, status);

-- SECONDARY: Device fingerprint clone detection
CREATE INDEX IF NOT EXISTS idx_click_fingerprint 
  ON clicks(device_fingerprint)
  WHERE device_fingerprint IS NOT NULL;

-- ========== TRANSACTION ==========
-- PRIMARY: User transaction history with type filtering
CREATE INDEX IF NOT EXISTS idx_tx_user_type_status 
  ON transactions(user_id, type, status);

-- SECONDARY: Date-range analytics
CREATE INDEX IF NOT EXISTS idx_tx_created_at 
  ON transactions(created_at);

-- ========== WITHDRAWAL ==========
-- PRIMARY: Admin withdrawal queue (status-based)
CREATE INDEX IF NOT EXISTS idx_withdrawal_status_created 
  ON withdrawals(status, created_at);

-- SECONDARY: User withdrawal history
CREATE INDEX IF NOT EXISTS idx_withdrawal_user_status 
  ON withdrawals(user_id, status);

-- ========== FRAUD LOG ==========
-- PRIMARY: User fraud history
CREATE INDEX IF NOT EXISTS idx_fraud_user_created 
  ON fraud_logs(user_id, created_at DESC);

-- SECONDARY: Fraud type statistics
CREATE INDEX IF NOT EXISTS idx_fraud_trigger_type 
  ON fraud_logs(trigger_type);

-- ========== OFFER ==========
-- PRIMARY: Active offers with provider filtering
CREATE INDEX IF NOT EXISTS idx_offer_provider_status 
  ON offers(provider, status);

-- SECONDARY: Active offers sorted by reward
CREATE INDEX IF NOT EXISTS idx_offer_status_reward 
  ON offers(status, reward_amount DESC)
  WHERE status = true;

-- ========== USER ==========
-- SECONDARY: User status filtering
CREATE INDEX IF NOT EXISTS idx_user_status 
  ON users(status);

-- SECONDARY: Risk score range queries
CREATE INDEX IF NOT EXISTS idx_user_risk_score 
  ON users(risk_score);
```

---

## Query Performance Expectations

| Query | Index Used | Expected Performance |
|-------|------------|---------------------|
| User lookup by email | email (unique) | ~1ms |
| Recent clicks by user (5min) | idx_click_user_created | ~2ms |
| Active offers by provider | idx_offer_provider_status | ~1ms |
| Pending withdrawals queue | idx_withdrawal_status_created | ~2ms |
| Device fingerprint clones | idx_click_fingerprint | ~10-50ms (depends on clone count) |
| User transaction history | idx_tx_user_type_status | ~3ms |
| Date-range revenue sum | idx_tx_created_at | ~10-50ms |

---

## Monitoring Queries (PostgreSQL)

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public';

-- Find missing indexes (sequential scans)
SELECT
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup
FROM pg_stat_user_tables
WHERE seq_scan > 1000
  AND n_live_tup > 10000
ORDER BY seq_scan DESC;
```

---

## Migration for Indexes

```bash
# Add indexes via Prisma migration
cd backend

# 1. Add @@index to schema.prisma models
# 2. Generate migration
npx prisma migrate dev --name add-performance-indexes

# 3. Verify in database
npx prisma db execute --stdin <<< "SELECT * FROM pg_indexes WHERE tablename = 'clicks';"
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*