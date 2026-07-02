# Tracking Engine: DZCASH

This document details the unique click-tracking, campaign routing, and Server-to-Server (S2S) Postback validation flows.

---

## 🔗 Redirection Lifecycle

1. **OfferWall Presentation**: User browses offers on the dashboard.
2. **Click Session Generation**:
   - The client invokes `/api/tracking/click?offerId={id}`.
   - The backend allocates a unique UUID as the `click_id`.
   - The backend records this in the `Click` table as status `CLICKED`.
   - The backend returns the advertiser-configured campaign redirect URL, replacing the macro `{click_id}` placeholder with the generated UUID.
3. **Advertiser Landing**: User lands on the advertiser's offerwall or survey router, carrying the `click_id` in their sub-ID parameter (e.g. `s1=[click_id]`, `subid=[click_id]`).
4. **Offer Execution**: User completes the survey or task.
5. **Advertiser S2S Postback Notification**:
   - The ad network triggers our S2S endpoint `/api/tracking/postback/{provider}?click_id=[click_id]&payout=[payout]&sig=[signature]`.

---

## 🔒 Postback Authentication Schemes

Different networks leverage different cryptographic validation schemes. The DZCASH platform implements adapters for the following:

### 1. CPX Research (HMAC-SHA256)
- **Signature verification**: Computes SHA256 HMAC of string: `${click_id}:${payout}:${status}` using `CPX_SECRET` as the key.
- **Verification comparison**: Uses timing-safe string comparison (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.

### 2. OfferToro (MD5 hashing)
- **Signature verification**: Computes MD5 hash of string: `${o_id}:${click_id}:${OFFERTORO_SECRET}`.
- **Verification comparison**: Direct comparison of hex hash strings.

### 3. Generic Provider (Pre-shared Token)
- **Signature verification**: Checks if the query param `token` matches the configured `GENERIC_PROVIDER_TOKEN` secret.

---

## 🛡️ Anti-Exploit Verification

Before updating user wallets, the Tracking Engine performs the following checks:
1. **Duplicate Prevention**: If the click ID has status `CONVERTED` or `REJECTED`, the postback rejects the request with a `409 Conflict` status, preventing balance inflation exploits.
2. **IP Location Audits**: Compares the click registration IP with the postback IP. If subnets represent geo-inconsistency (VPN/Proxy usage during survey completion), a high-risk security alert is logged.
3. **Velocity Audit**: If a user completes more than 15 offers within a 5-minute window, conversions are automatically frozen.
