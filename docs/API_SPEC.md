# API Specifications: DZCASH

This document details all API routes exposed by the DZCASH application.

---

## 🔐 Auth API

### 1. Register User
- **URL**: `/api/auth/register`
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "email": "user@email.com",
    "password": "userpass123",
    "referredByCode": "ABCDEF" // Optional
  }
  ```

### 2. Login User
- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Payload**:
  ```json
  {
    "email": "user@email.com",
    "password": "userpass123"
  }
  ```
- **Response**:
  ```json
  {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "user": { "id": "uuid", "email": "user@email.com", "status": "ACTIVE", "riskScore": 0 }
  }
  ```

---

## 📈 Tracking API

### 1. Register Click (Generate tracking session)
- **URL**: `/api/tracking/click?offerId=uuid`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer jwt_token`
- **Response**:
  ```json
  {
    "clickId": "generated-uuid-click-id",
    "redirectUrl": "http://localhost:4000/api/offers/cpx/mock?click_id=generated-uuid-click-id"
  }
  ```

### 2. S2S Postback webhook callback
- **URL**: `/api/tracking/postback/:provider`
- **Method**: `GET` / `POST`
- **Parameters**: `provider` (cpx, offertoro, generic)
- **Validation**: HMAC/MD5 signature query param checks
- **Response**: `200 OK` + `{ "success": true, "reward": 0.90 }`

---

## 💰 Wallet & Withdrawal API

### 1. Get Wallet Balance
- **URL**: `/api/wallet/balance`
- **Method**: `GET`
- **Headers**: `Authorization: Bearer jwt_token`

### 2. Request Payout
- **URL**: `/api/wallet/withdraw`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer jwt_token`
- **Payload**:
  ```json
  {
    "method": "PAYPAL", // or "CRYPTO"
    "amount": 15.00,
    "details": { "email": "paypal@email.com" }
  }
  ```

---

## 🛡️ Admin API
(All routes require `Authorization: Bearer jwt_token` where the user email matches the system administrator email: `admin@dzcash.com`).

- `GET /api/admin/users`: List all platform users and wallets.
- `POST /api/admin/users/:id/status`: Suspend/Freeze user accounts.
- `GET /api/admin/withdrawals`: Review cashout requests queue.
- `POST /api/admin/withdrawals/:id/approve`: Approve and mark withdrawal as completed.
- `POST /api/admin/withdrawals/:id/reject`: Reject withdrawal, refunding the user's available balance.
- `POST /api/admin/transactions/:id/settle`: Release pending conversions.
- `POST /api/admin/transactions/:id/reverse`: Claw back completions due to fraudulent activities.
