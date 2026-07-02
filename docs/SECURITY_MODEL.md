# Security & Threat Model: DZCASH

This document lists the security designs, threat classifications, and defense mitigations deployed on DZCASH.

---

## 🔒 Implemented Security Protections

### 1. Cryptographic Authentication & Token Rotation
- User passwords are encrypted using **Bcrypt** (work factor 10).
- Session authorization uses short-lived **JWT Tokens** (15-minute expiry).
- Session persistence leverages cryptographically signed **Refresh Tokens** stored in the database. When a user requests a new JWT token, the refresh token is rotated (the old one is invalidated, and a new one is created), mitigating replay attacks.

### 2. Double-Entry Ledger Protection
- Wallets are locked inside serialized database transactions (`$transaction`) inside [WalletService](file:///c:/xampp/htdocs/dzcash/backend/src/wallet/wallet.service.ts).
- Balances are updated via incremental database modifications (`increment`/`decrement`) instead of calculating values in memory, preventing race-condition and balance double-spend exploits.

### 3. S2S Endpoint Hardening
- Webhook callbacks from advertisers (`/api/tracking/postback/*`) require valid cryptographic hashes (HMAC-SHA256, MD5) using pre-shared secrets.
- Timing-safe string matching (`crypto.timingSafeEqual`) is utilized for CPX Research signature checking to prevent timing side-channel exploits.

### 4. Admin Routing Privilege Guarding
- Admin APIs are protected using two checks:
  1. Valid JWT validation.
  2. [AdminGuard](file:///c:/xampp/htdocs/dzcash/backend/src/admin/guards/admin.guard.ts) checking if email matches system administrator profile.
- Next.js Admin page blocks display for non-admin email targets, keeping interfaces isolated.

---

## 🛡️ Anti-Fraud Rules (Fraud Engine)
- Checks user device fingerprint duplication. Cloned fingerprints flag accounts.
- Screen conversion IPs for VPN/Proxy patterns.
- Automated holding limits (Risk Score > 70 freezes withdrawal processing; Risk Score > 85 suspends user access).
