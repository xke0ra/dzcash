# Referral System - DZCASH

> **Purpose**: Complete specifications for the referral program.

---

## Overview

- **Commission**: 10% of referred user's reward on every offer completion
- **Duration**: Lifetime (no cap, no expiry)
- **Payment**: Instant to referrer's `availableBalance`
- **Tracking**: 6-character referral code (uppercase alphanumeric)

---

## Key Mechanics

### Referral Code Generation
```typescript
// backend/src/auth/auth.service.ts
// During registration
let referralCode = '';
let codeExists = true;
while (codeExists) {
  referralCode = Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
  
  codeExists = await this.prisma.user.findUnique({
    where: { referralCode },
  });
}
// referralCode = "XK9M2P" (example)
```

### Referral Tracking
```typescript
// User model self-relation
model User {
  id           String   @id @default(uuid())
  referredById String?  // ID of the user who referred this user
  referredBy   User?    @relation("UserReferrals", fields: [referredById], references: [id])
  referrals    User[]   @relation("UserReferrals")
}
```

### Registration with Referral
```typescript
// backend/src/auth/auth.service.ts
if (dto.referredByCode) {
  const referrer = await this.prisma.user.findUnique({
    where: { referralCode: dto.referredByCode.toUpperCase() },
  });
  if (!referrer) {
    throw new BadRequestException('Invalid referral code');
  }
  referredById = referrer.id;
}
```

---

## Referral Bonus Logic

```typescript
// backend/src/tracking/tracking.service.ts
// Executed inside the same $transaction as the main conversion

if (click.user.referredById) {
  const referrerId = click.user.referredById;
  const referralBonus = reward.mul(0.10); // 10%

  // Pay referrer instantly to availableBalance
  await tx.wallet.update({
    where: { userId: referrerId },
    data: { availableBalance: { increment: referralBonus } },
  });

  // Create referral bonus transaction (COMPLETED instantly)
  await tx.transaction.create({
    data: {
      userId: referrerId,
      type: TransactionType.REFERRAL_BONUS,
      amount: referralBonus,
      status: TransactionStatus.COMPLETED,
      notes: `Referral commission from user ${click.userId.substring(0, 8)}`,
    },
  });
}
```

### Key Properties
| Property | Value | Reason |
|----------|-------|--------|
| Commission % | 10% | Competitive, sustainable |
| Payment Timing | Instant | User motivation |
| Balance Type | `availableBalance` | Can withdraw immediately |
| Duration | Lifetime | Encourages long-term referrals |
| Self-referral | Not possible (by design) | Need separate signup |

---

## Referral API

### Endpoints

#### GET /api/users/me
Returns referral code in user profile
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "referralCode": "XK9M2P",
  "status": "ACTIVE",
  "riskScore": 0,
  "wallet": {
    "pendingBalance": "5.00",
    "availableBalance": "2.50"
  }
}
```

#### GET /api/users/referrals
```json
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

## Frontend Implementation

### Referral Link Component
```typescript
// frontend/src/components/referral/ReferralLink.tsx
const referralLink = `${window.location.origin}/register?ref=${profile.referralCode}`;

// Display as read-only input with copy button
// Copied state shows checkmark for 2 seconds
```

### Referral Registration
```typescript
// frontend/src/app/register/page.tsx
// URL: /register?ref=ABCDEF (pre-fills referral code)
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) setReferralCode(ref);
}, []);
```

---

## Anti-Fraud Measures

### Self-Referral Prevention
```typescript
// Already prevented by design (need separate email/account)
// Additional: IP check on registration (PLANNED)
```

### Referral Ring Detection (PLANNED)
```typescript
// Graph analysis to detect referral loops:
// A -> B -> C -> A
// Would flag identical IPs, devices in referral chain
```

---

## Analytics (PLANNED)

### Referral Dashboard Stats
```typescript
interface ReferralStats {
  totalReferrals: number;       // Total users referred
  activeReferrals: number;      // Users who completed at least 1 offer
  totalEarned: number;          // Lifetime commission earned
  earningsByMonth: {            // Chart data
    month: string;
    amount: number;
  }[];
  topReferrals: {               // Active referrer's top earners
    userId: string;
    email: string;
    totalCommission: number;
  }[];
}
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*