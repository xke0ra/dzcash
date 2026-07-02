# Withdrawal Flow - DZCASH

> **Purpose**: Complete specifications for the withdrawal process.

---

## Overview

Users can withdraw earnings via multiple payment methods. All withdrawals require admin approval (manual review).

### Current Methods
| Method | Status | Details Field | Min/Max |
|--------|--------|---------------|---------|
| PayPal | ✅ Active | `{ email: string }` | $5 - $10,000 |
| Crypto | ❌ Planned | `{ address: string, network: string }` | TBD |
| Gift Card | ❌ Planned | `{ type: string, value: number }` | TBD |

---

## Withdrawal Lifecycle

```
USER                   SYSTEM                  ADMIN
  |                       |                       |
  |-- POST /wallet/withdraw                     |
  |   { method: PAYPAL,   |                       |
  |     amount: 50,       |                       |
  |     details: {        |                       |
  |       email: "..."    |                       |
  |     }                 |                       |
  |---------------------->|                       |
  |                       |                       |
  |                  Validate:                     |
  |                  - Not FROZEN/SUSPENDED        |
  |                  - availableBalance >= $50     |
  |                  - min/max constraints          |
  |                  - details format              |
  |                       |                       |
  |                  BEGIN $transaction            |
  |                  availableBalance -= 50        |
  |                  Withdrawal (PENDING)          |
  |                  Transaction (PENDING)         |
  |                  COMMIT                       |
  |                       |                       |
  |<-- 201 { withdrawal }|                       |
  |                       |                       |
  |            (withdrawal pending)                |
  |                       |                       |
  |                       |   Admin reviews        |
  |                       |   withdrawal queue    |
  |                       |<----------------------|
  |                       |                       |
  |                       |  APPROVE or REJECT    |
  |                       |                       |
  |           [APPROVE]   |                       |
  |                  $transaction                  |
  |                  Withdrawal -> APPROVED        |
  |                  Transaction -> COMPLETED      |
  |                  Process payment externally    |
  |                       |                       |
  |           [REJECT]    |                       |
  |                  $transaction                  |
  |                  availableBalance += 50       |
  |                  Withdrawal -> REJECTED        |
  |                  Transaction -> REJECTED       |
  |                       |                       |
```

---

## Request Withdrawal

### Endpoint
```typescript
// POST /api/wallet/withdraw
// Headers: Authorization: Bearer <token>
// Body: { method: "PAYPAL", amount: 50, details: { email: "user@email.com" } }
```

### DTO Validation
```typescript
// backend/src/wallet/dto/withdraw.dto.ts
export class WithdrawDto {
  @IsEnum(WithdrawalMethod)
  @IsNotEmpty()
  method: WithdrawalMethod;

  @IsNumber()
  @Min(5.00, { message: 'Minimum withdrawal is $5.00' })
  @Max(10000, { message: 'Maximum withdrawal is $10,000. Contact support for larger amounts' })
  amount: number;

  @IsObject()
  @ValidateNested()
  @Type(() => WithdrawalDetailsDto)
  details: WithdrawalDetailsDto;
}

export class WithdrawalDetailsDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
```

### Service Implementation
```typescript
// backend/src/wallet/wallet.service.ts
async requestWithdrawal(userId: string, dto: WithdrawDto): Promise<Withdrawal> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Verify user exists and not restricted
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === 'FROZEN' || user.status === 'SUSPENDED') {
      throw new BadRequestException('Account restricted from withdrawals');
    }

    // 2. Check sufficient balance
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.availableBalance.toNumber() < dto.amount) {
      throw new BadRequestException('Insufficient available balance');
    }

    // 3. Deduct from available balance
    await tx.wallet.update({
      where: { userId },
      data: { availableBalance: { decrement: dto.amount } },
    });

    // 4. Create withdrawal request
    const withdrawal = await tx.withdrawal.create({
      data: {
        userId,
        method: dto.method,
        status: WithdrawalStatus.PENDING,
        amount: dto.amount,
        details: dto.details,
      },
    });

    // 5. Create associated transaction
    await tx.transaction.create({
      data: {
        userId,
        type: TransactionType.WITHDRAWAL,
        amount: dto.amount,
        status: TransactionStatus.PENDING,
        withdrawalId: withdrawal.id,
        notes: `Withdrawal request via ${dto.method}`,
      },
    });

    return withdrawal;
  });
}
```

---

## Admin Approval

```typescript
// backend/src/wallet/wallet.service.ts
async approveWithdrawal(withdrawalId: string): Promise<Withdrawal> {
  return this.prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Withdrawal is not pending');
    }

    // Mark as approved
    const updated = await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.APPROVED,
        processedAt: new Date(),
      },
    });

    // Complete transaction
    await tx.transaction.update({
      where: { withdrawalId },
      data: { status: TransactionStatus.COMPLETED },
    });

    return updated;
  });
}
```

---

## Admin Rejection

```typescript
// backend/src/wallet/wallet.service.ts
async rejectWithdrawal(withdrawalId: string): Promise<Withdrawal> {
  return this.prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Withdrawal is not pending');
    }

    // REFUND: Return funds to available balance
    await tx.wallet.update({
      where: { userId: withdrawal.userId },
      data: { availableBalance: { increment: withdrawal.amount } },
    });

    // Mark as rejected
    const updated = await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.REJECTED,
        processedAt: new Date(),
      },
    });

    // Reject transaction
    await tx.transaction.update({
      where: { withdrawalId },
      data: {
        status: TransactionStatus.REJECTED,
        notes: 'Withdrawal rejected - funds refunded to available balance',
      },
    });

    return updated;
  });
}
```

---

## State Machine

```
                    ┌─────────────┐
                    │   PENDING   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              v            v            v
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ APPROVED │ │ REJECTED │ │  FAILED  │  (PLANNED)
        └──────────┘ └──────────┘ └──────────┘
```

---

## Withdrawal History API

```typescript
// GET /api/wallet/withdrawals
async getWithdrawals(userId: string) {
  return this.prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}
```

**Response:**
```json
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

---

## Transaction History

```typescript
// GET /api/wallet/transactions
async getTransactions(userId: string) {
  return this.prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}
```

---

## Email Notifications (PLANNED)

```typescript
// When withdrawal status changes:
// 1. WITHDRAWAL_SUBMITTED - "Your withdrawal of $X has been submitted"
// 2. WITHDRAWAL_APPROVED  - "Your withdrawal of $X has been approved and will be sent shortly"
// 3. WITHDRAWAL_REJECTED  - "Your withdrawal of $X was rejected. Reason: ..."
```

---

## Future Enhancements (PLANNED)

### Automated Crypto Payouts
```typescript
// Integration with exchange or payment processor
// 1. Admin approves withdrawal
// 2. System sends crypto via API
// 3. Status updated to COMPLETED or FAILED
```

### Auto-Approval Rules
```typescript
// For trusted users (low risk score, has previous withdrawals):
// Auto-approve withdrawals under $100
// Manual review for suspicious cases
```

### Batch Processing
```typescript
// Admin can select multiple withdrawals and approve/reject in bulk
// Generate CSV/PDF report of processed withdrawals
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*