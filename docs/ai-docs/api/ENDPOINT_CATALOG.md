# API Endpoint Catalog - DZCASH

> **Purpose**: Complete catalog of all API endpoints with request/response examples.

---

## Auth API (`/api/auth`)

### POST /api/auth/register
```
Create a new user account.

Request:
{
  "email": "user@example.com",
  "password": "securepass123",
  "referredByCode": "ABCDEF"    // Optional
}

Response (201):
{
  "message": "Registration successful",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "referralCode": "XK9M2P"
}

Errors:
  - 409 Conflict: Email already registered
  - 400 Bad Request: Invalid referral code
  - 400 Bad Request: Validation errors (email format, password length)
```

### POST /api/auth/login
```
Authenticate user and return tokens.

Request:
{
  "email": "user@example.com",
  "password": "securepass123"
}

Response (200):
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "status": "ACTIVE",
    "riskScore": 0
  }
}

Errors:
  - 401 Unauthorized: Invalid email or password
  - 401 Unauthorized: Account suspended
```

### POST /api/auth/refresh
```
Rotate refresh token and get new access token.

Request:
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response (200):
{
  "accessToken": "new_token",
  "refreshToken": "new_refresh_token"
}

Errors:
  - 401 Unauthorized: Invalid or expired refresh token
```

### POST /api/auth/logout
```
Invalidate current session.

Request:
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response (200):
{
  "message": "Logged out successfully"
}
```

---

## Users API (`/api/users`)

### GET /api/users/me
```
Get current user profile with wallet.

Headers: Authorization: Bearer <accessToken>

Response (200):
{
  "id": "uuid",
  "email": "user@example.com",
  "status": "ACTIVE",
  "riskScore": 0,
  "referralCode": "XK9M2P",
  "createdAt": "2026-07-01T10:00:00Z",
  "wallet": {
    "pendingBalance": "5.00",
    "availableBalance": "2.50"
  }
}

Errors:
  - 401 Unauthorized: Invalid or expired token
```

### GET /api/users/referrals
```
Get list of users referred by current user.

Headers: Authorization: Bearer <accessToken>

Response (200):
[
  {
    "id": "uuid",
    "email": "referred@email.com",
    "status": "ACTIVE",
    "createdAt": "2026-07-01T10:00:00Z"
  }
]
```

---

## Wallet API (`/api/wallet`)

### GET /api/wallet/balance
```
Get wallet balances.

Headers: Authorization: Bearer <accessToken>

Response (200):
{
  "pendingBalance": 5.00,
  "availableBalance": 2.50
}
```

### GET /api/wallet/transactions
```
Get transaction history (sorted by date, newest first).

Headers: Authorization: Bearer <accessToken>

Response (200):
[
  {
    "id": "uuid",
    "type": "OFFER_CONVERSION",
    "amount": "0.90",
    "status": "PENDING",
    "notes": "Offer: CPX Quick Survey",
    "createdAt": "2026-07-02T10:00:00Z"
  }
]

Query params (PLANNED):
  - type: OFFER_CONVERSION | WITHDRAWAL | REFERRAL_BONUS
  - status: PENDING | COMPLETED | REVERSED | REJECTED
  - from: ISO date
  - to: ISO date
```

### GET /api/wallet/withdrawals
```
Get withdrawal history.

Headers: Authorization: Bearer <accessToken>

Response (200):
[
  {
    "id": "uuid",
    "method": "PAYPAL",
    "status": "PENDING",
    "amount": "50.00",
    "details": { "email": "user@example.com" },
    "processedAt": null,
    "createdAt": "2026-07-02T10:00:00Z"
  }
]
```

### POST /api/wallet/withdraw
```
Request a withdrawal.

Headers: Authorization: Bearer <accessToken>

Request:
{
  "method": "PAYPAL",
  "amount": 50.00,
  "details": {
    "email": "user@example.com"
  }
}

Response (201):
{
  "id": "uuid",
  "method": "PAYPAL",
  "status": "PENDING",
  "amount": "50.00",
  "details": { "email": "user@example.com" },
  "createdAt": "2026-07-02T10:00:00Z"
}

Errors:
  - 400: Insufficient balance
  - 400: Account restricted (FROZEN/SUSPENDED)
  - 400: Validation errors
```

---

## Offers API (`/api/offers`)

### GET /api/offers
```
Get list of active offers.

Headers: Authorization: Bearer <accessToken>

Response (200):
[
  {
    "id": "uuid",
    "provider": "CPX",
    "name": "CPX Quick Survey",
    "description": "Earn rewards by sharing your opinion",
    "payoutAmount": "1.20",
    "rewardAmount": "0.90"
  }
]
```

---

## Tracking API (`/api/tracking`)

### GET /api/tracking/click?offerId=xxx
```
Register a click and get redirect URL.

Headers: Authorization: Bearer <accessToken>
         x-device-fingerprint: <hash> (optional)

Response (200):
{
  "clickId": "550e8400-e29b-41d4-a716-446655440000",
  "targetUrl": "http://advertiser.com/offer?click_id=550e8400-..."
}

Errors:
  - 404: Offer not found
  - 400: Action blocked (SUSPENDED/FROZEN)
```

### GET/POST /api/tracking/postback/:provider
```
S2S postback from advertiser.

Parameters:
  - provider: 'cpx' | 'offertoro' | 'generic'

Query params (provider-specific):
  - click_id (required)
  - payout (required)
  - signature/sig/token (required - provider-specific)

Response (200):
{
  "success": true,
  "transactionId": "uuid",
  "reward": 0.90
}

Errors:
  - 400: Invalid signature
  - 404: Click not found
  - 409: Click already processed
```

---

## Admin API (`/api/admin`) [PLANNED]

### GET /api/admin/stats
```
Get dashboard statistics.

Headers: Authorization: Bearer <accessToken> (Admin only)

Response (200):
{
  "totalUsers": 1500,
  "newUsersToday": 23,
  "offersCompleted": 4500,
  "pendingWithdrawals": 12,
  "totalPayoutToday": 1250.50,
  "fraudAlertsToday": 3,
  "revenue": 450.75
}
```

### GET /api/admin/users
```
Get paginated user list.

Query params:
  - page: 1 (default)
  - limit: 25 (default, max 100)
  - status: ACTIVE | FROZEN | SUSPENDED
  - search: email partial match
  - minRisk: number
  - maxRisk: number

Response (200):
{
  "users": [ ... ],
  "total": 1500,
  "page": 1,
  "limit": 25,
  "totalPages": 60
}
```

### PATCH /api/admin/users/:id/status
```
Update user status.

Request:
{
  "status": "ACTIVE" | "FROZEN" | "SUSPENDED",
  "reason": "Reviewed fraud case - false positive"
}
```

### GET /api/admin/withdrawals
```
Get withdrawal queue (PENDING first, oldest first).

Query params:
  - status: PENDING | APPROVED | REJECTED
  - page, limit

Response (200):
{
  "withdrawals": [ ... ],
  "total": 12,
  "page": 1,
  "limit": 25
}
```

### POST /api/admin/withdrawals/:id/approve
```
Approve pending withdrawal.

Response (200):
{
  "id": "uuid",
  "status": "APPROVED",
  "processedAt": "2026-07-02T10:00:00Z"
}
```

### POST /api/admin/withdrawals/:id/reject
```
Reject pending withdrawal with reason.

Request:
{
  "reason": "Suspicious account activity"
}
```

### GET /api/admin/fraud
```
Get fraud logs.

Query params:
  - reviewed: true | false (default: false)
  - userId: filter by user

Response (200):
[
  {
    "id": "uuid",
    "userId": "uuid",
    "triggerType": "VPN_DETECTED",
    "score": 45,
    "details": { "ip": "8.8.8.8" },
    "createdAt": "2026-07-02T10:00:00Z"
  }
]
```

### POST /api/admin/fraud/:id/review
```
Review fraud log entry.

Request:
{
  "action": "dismiss" | "sustain",
  "notes": "User contacted support - was using university WiFi"
}
```

---

## Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2026-07-02T10:00:00.000Z",
  "path": "/api/wallet/withdraw"
}
```

### Common HTTP Status Codes
```
200: Success (GET)
201: Created (POST)
204: No Content (DELETE)
400: Bad Request (validation error)
401: Unauthorized (invalid/missing token)
403: Forbidden (insufficient permissions)
404: Not Found
409: Conflict (duplicate, already processed)
429: Too Many Requests (rate limited)
500: Internal Server Error
```

---

## Rate Limits (PLANNED)

| Endpoint Group | Limit | Burst | Period |
|----------------|-------|-------|--------|
| Auth (login, register) | 10 | 5 | 1 minute |
| Wallet (withdraw) | 3 | 2 | 1 minute |
| Tracking (click) | 30 | 10 | 1 minute |
| Tracking (postback) | 100 | 50 | 1 minute |
| Admin | 60 | 20 | 1 minute |
| General | 60 | 30 | 1 minute |

---

*Last Updated: 2026-07-02 | Version: 1.0.0*