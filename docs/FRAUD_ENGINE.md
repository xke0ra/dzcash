# Fraud Detection Engine: DZCASH

This document details the mechanics, risk scoring criteria, and penalty rules within the DZCASH Fraud Detection Service.

---

## ⚙️ How It Works

The [FraudService](file:///c:/xampp/htdocs/dzcash/backend/src/fraud/fraud.service.ts) evaluates user metrics at three distinct lifecycles:
1. **Redirection Init (Click)**: Tracks velocity and device fingerprint clones.
2. **Conversion Callback (Postback Webhook)**: Audits Geo IP inconsistency and VPN checks.
3. **Cashout requests (Withdrawal Submit)**: Checks current user risk scoring profiles.

---

## 📊 Risk Scoring Matrices

We calculate a dynamic score ranging from 0 to 100 based on the following indicators:

### 1. VPN & Proxy Detection (+45 Score Penalty)
- **Indicators**: Checks request IP address against reputation filters.
- **Local Testing**: The mock engine flags IP `127.0.0.9`, `8.8.8.8`, or anything containing `vpn`/`proxy`.

### 2. Device Fingerprint Clones (+25 to +50 Score Penalty)
- **Indicators**: Unique hardware/browser footprints are sent from the client headers.
- **Rule**: If a fingerprint maps to more than one distinct user account, the risk score is incremented by `clones * 25`.

### 3. High-Velocity Completions (+30 Score Penalty)
- **Indicators**: Number of clicks registered in the past 5 minutes.
- **Rule**: If a user creates more than 15 offer clicks within 5 minutes, they are flagged.

### 4. Geo-Inconsistency Check (+40 Score Penalty)
- **Indicators**: Click IP subnet location vs conversion callback IP subnet location.
- **Rule**: If subnets represent different locations, a geo-inconsistency fraud log is recorded.

---

## 🛑 Automated Penalty Enforcement

Once the cumulative risk score is calculated, the system applies the following security states:

- **Score >= 70 (`FROZEN`)**: The user's available balance is frozen. They can complete offers, but withdrawals are blocked and routed to manual admin review.
- **Score >= 85 (`SUSPENDED`)**: The user account is locked. Logins are rejected with an auth error, and all pending/available balances are suspended.
- **Manual Review**: System administrators can review security logs inside the admin panel and manually set the status back to `ACTIVE` (resetting status) or keep them locked.
