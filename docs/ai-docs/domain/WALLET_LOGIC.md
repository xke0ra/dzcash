# Wallet Logic - DZCASH

> **Purpose**: Complete reference for all wallet operations, balance management, and financial transactions.

---

## Core Principles

1. **Never calculate balance in memory** - Always use Prisma `increment`/`decrement`
2. **Every balance change must have a Transaction record** - Complete audit trail
3. **All balance operations must use `$transaction`** - Atomicity and row-level locking
4. **Never hardcode balance values** - Always increment/decrement from current

---

## Dual Balance Model

```typescript
// backend/prisma/schema.prisma
model Wallet {
  id               String   @id @default(uuid())
  userId           String   @unique
  pendingBalance   Decimal  @default(0.00) @db.Decimal(12, 4)  // Unverified earnings
  availableBalance Decimal  @default(0.00) @db.Decimal(12, 4)  // Ready for withdrawal
}
```

### Balance Lifecycle
```
offer_conversion
       |
       v
pendingBalance += reward                (PENDING)
       |
       v (admin settles)
pendingBalance -= reward
availableBalance += reward              (COMPLETED)
       |
       v (user withdraws)
availableBalance -= amount              (PENDING withdrawal)
       |
       ├── admin approves:              (COMPLETED)
       ├── admin rejects:               (REJECTED)
       |     availableBalance += amount (REFUNDED)
       └── fraud reversal:             (REVERSED)
             availableBalance -= amount
```

---

## All Wallet Operations

### Operation 1: Credit Pending Balance (Postback Conversion)

```typescript
// backend/src/wallet/wallet.service.ts

/**
 * Called by TrackingService when postback is validated
 * Adds reward to user's pending balance atomically
 */
async creditPending(
  userId: string,
  amount: number,
  clickId?: string,
  notes?: string,
): Promise<Transaction> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Verify wallet exists
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    // 2. Increment pending balance (ROW LOCK via $transaction)
    await tx.wallet.update({
      where: { userId },
      data: { pendingBalance: { increment: amount } },
    });

    // 3. Create transaction record (audit trail)
    return tx.transaction.create({
      data: {
        userId,
        type: TransactionType.OFFER_CONVERSION,
        amount,
        status: TransactionStatus.PENDING,
        clickId,
        notes,
      },
    });
  });
}
```

**Invariants:**
- `pendingBalance += reward` (always non-negative)
- Transaction status: `PENDING`
- Called once per validated postback

---

### Operation 2: Settle Transaction (Admin Action)

```typescript
/**
 * Moves funds from pending to available
 * Called by admin when transaction is verified
 */
async settleTransaction(transactionId: string): Promise<Transaction> {
  return this.prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Transaction is not pending');
    }

    // Move pending -> available
    await tx.wallet.update({
      where: { userId: transaction.userId },
      data: {
        pendingBalance: { decrement: transaction.amount },
        availableBalance: { increment: transaction.amount },
      },
    });

    return tx.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.COMPLETED },
    });
  });
}
```

---

### Operation 3: Reverse Transaction (Fraud Chargeback)

```typescript
/**
 * Reverses a conversion due to fraud
 * Handles both PENDING and COMPLETED transactions
 */
async reverseTransaction(transactionId: string): Promise<Transaction> {
  return this.prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new NotFoundException('Transaction not found');
    if ([TransactionStatus.REVERSED, TransactionStatus.REJECTED].includes(transaction.status)) {
      throw new BadRequestException('Transaction already settled or reversed');
    }

    const statusBefore = transaction.status;

    // Reverse the correct balance
    if (statusBefore === TransactionStatus.PENDING) {
      // Was not settled yet - reverse pending balance
      await tx.wallet.update({
        where: { userId: transaction.userId },
        data: { pendingBalance: { decrement: transaction.amount } },
      });
    } else if (statusBefore === TransactionStatus.COMPLETED) {
      // Was settled - reverse available balance
      await tx.wallet.update({
        where: { userId: transaction.userId },
        data: { availableBalance: { decrement: transaction.amount } },
      });
    }

    return tx.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.REVERSED,
        notes: 'Reversed due to fraud/chargeback',
      },
    });
  });
}
```

---

### Operation 4: Request Withdrawal

```typescript
/**
 * User requests to withdraw funds
 * Validates balance, deducts from available, creates pending withdrawal
 */
async requestWithdrawal(userId: string, dto: WithdrawDto): Promise<Withdrawal> {
  return this.prisma.$transaction(async (tx) => {
    // 1. Verify user not frozen
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === 'FROZEN' || user.status === 'SUSPENDED') {
      throw new BadRequestException('Account restricted from withdrawals');
    }

    // 2. Check sufficient balance
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    
    const available = wallet.availableBalance.toNumber();
    if (available < dto.amount) {
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
        notes: `Withdrawal via ${dto.method}`,
      },
    });

    return withdrawal;
  });
}
```

**Validation Rules:**
- User must not be FROZEN or SUSPENDED
- `availableBalance >= dto.amount`
- Minimum withdrawal: $5 (configurable)
- Maximum withdrawal: (no limit, but may require KYC)

---

### Operation 5: Approve Withdrawal (Admin)

```typescript
/**
 * Admin approves a pending withdrawal
 * Marks as APPROVED, completes transaction
 */
async approveWithdrawal(withdrawalId: string): Promise<Withdrawal> {
  return this.prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Withdrawal is not pending');
    }

    await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.APPROVED,
        processedAt: new Date(),
      },
    });

    await tx.transaction.update({
      where: { withdrawalId },
      data: { status: TransactionStatus.COMPLETED },
    });

    return tx.withdrawal.findUnique({ where: { id: withdrawalId } });
  });
}
```

---

### Operation 6: Reject Withdrawal (Admin)

```typescript
/**
 * Admin rejects a pending withdrawal
 * Refunds the amount to user's available balance
 */
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

    await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: WithdrawalStatus.REJECTED,
        processedAt: new Date(),
      },
    });

    await tx.transaction.update({
      where: { withdrawalId },
      data: {
        status: TransactionStatus.REJECTED,
        notes: 'Withdrawal rejected - funds refunded',
      },
    });

    return tx.withdrawal.findUnique({ where: { id: withdrawalId } });
  });
}
```

---

## Balance Validation Rules

### Input Validation (WithdrawDto)
```typescript
// backend/src/wallet/dto/withdraw.dto.ts
export class WithdrawDto {
  @IsEnum(WithdrawalMethod)
  @IsNotEmpty()
  method: WithdrawalMethod;

  @IsNumber()
  @Min(5.00, { message: 'Minimum withdrawal is $5.00' })
  @Max(10000, { message: 'Maximum withdrawal is $10,000' })
  amount: number;

  @IsObject()
  @ValidateNested()
  @Type(() => WithdrawalDetailsDto)
  details: WithdrawalDetailsDto;
}
```

### Business Validation (in Service)
```typescript
// Must check BEFORE any wallet modification:
1. user.status !== 'SUSPENDED'  -> throw UnauthorizedException
2. user.status !== 'FROZEN'     -> throw BadRequestException
3. wallet.availableBalance >= amount  -> throw BadRequestException
4. amount >= MIN_WITHDRAWAL     -> throw BadRequestException
5. amount <= MAX_WITHDRAWAL     -> throw BadRequestException (or require KYC)
```

---

## Transaction State Machine

```
OFFER_CONVERSION:
  PENDING -> COMPLETED  (admin settlement)
  PENDING -> REVERSED   (fraud before settlement)
  COMPLETED -> REVERSED (fraud after settlement)

WITHDRAWAL:
  PENDING -> COMPLETED  (admin approval)
  PENDING -> REJECTED   (admin rejection)

REFERRAL_BONUS:
  COMPLETED (instant, no pending)

FRAUD_REVERSAL:
  COMPLETED (auto or manual)
```

---

## Error Scenarios & Handling

| Scenario | Error Type | Message |
|----------|------------|---------|
| User not found | NotFoundException | 'User not found' |
| Wallet not found | NotFoundException | 'Wallet not found' |
| Insufficient balance | BadRequestException | 'Insufficient available balance' |
| User frozen | BadRequestException | 'Account restricted from withdrawals' |
| User suspended | UnauthorizedException | 'Account is suspended' |
| Transaction not found | NotFoundException | 'Transaction not found' |
| Transaction already settled | BadRequestException | 'Transaction is not pending' |
| Withdrawal not found | NotFoundException | 'Withdrawal request not found' |
| Withdrawal not pending | BadRequestException | 'Withdrawal is not pending approval' |

---

## Concurrency Protection

```typescript
// All wallet operations use Prisma $transaction which provides:
// 1. SERIALIZABLE isolation level (default for $transaction)
// 2. Row-level locks on updated rows
// 3. Automatic rollback on error

// This prevents:
// - Double-withdrawal (user submits twice before check)
// - Race conditions on postback processing
// - Balance inconsistencies

// WRONG: This has a race condition
async badMethod(userId: string, amount: number) {
  const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
  if (wallet.availableBalance >= amount) {
    // RACE: Another request could deduct between check and update
    await this.prisma.wallet.update({
      where: { userId },
      data: { availableBalance: { decrement: amount } },
    });
  }
}

// CORRECT: Atomic check + update in $transaction
async goodMethod(userId: string, amount: number) {
  return this.prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.availableBalance < amount) {
      throw new BadRequestException('Insufficient balance');
    }
    await tx.wallet.update({
      where: { userId },
      data: { availableBalance: { decrement: amount } },
    });
  });
}
```

---

## Referral Bonus Logic

```typescript
// Called during postback conversion (same transaction)
if (click.user.referredById) {
  const referrerId = click.user.referredById;
  const referralBonus = reward.mul(0.10); // 10%

  // NOTE: Referral bonus is CRITICAL - paid to availableBalance immediately
  await tx.wallet.update({
    where: { userId: referrerId },
    data: { availableBalance: { increment: referralBonus } },
  });

  await tx.transaction.create({
    data: {
      userId: referrerId,
      type: TransactionType.REFERRAL_BONUS,
      amount: referralBonus,
      status: TransactionStatus.COMPLETED, // Instant, no pending
      notes: `Referral commission from user ${click.user.id.substring(0, 8)}`,
    },
  });
}
```

---

## Audit & Reconciliation

```sql
-- Daily reconciliation query
SELECT 
  u.id,
  u.email,
  w.pending_balance,
  w.available_balance,
  SUM(CASE WHEN t.status = 'PENDING' AND t.type = 'OFFER_CONVERSION' THEN t.amount ELSE 0 END) as uncredited_pending,
  SUM(CASE WHEN t.type = 'WITHDRAWAL' AND t.status IN ('PENDING', 'COMPLETED') THEN t.amount ELSE 0 END) as total_withdrawn
FROM users u
JOIN wallets w ON w.user_id = u.id
LEFT JOIN transactions t ON t.user_id = u.id
GROUP BY u.id, u.email, w.pending_balance, w.available_balance;

-- Check for balance discrepancies
SELECT * FROM wallets
WHERE pending_balance < 0 OR available_balance < 0;
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*