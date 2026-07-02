# Frontend Component Library - DZCASH

> **Purpose**: Complete reference for all UI components, hooks, and patterns.

---

## Component Architecture

### Default: Server Component
```typescript
// pages/dashboard/page.tsx - Server Component (default)
import { getServerSession } from 'next-auth';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const session = await getServerSession();
  const data = await fetch(`http://backend:4000/api/users/me`, {
    headers: { Authorization: `Bearer ${session?.accessToken}` },
  }).then(r => r.json());

  return <DashboardClient initialData={data} />;
}
```

### When to Use 'use client'
```typescript
// Only use 'use client' when you need:
// 1. useState / useEffect / useReducer
// 2. Browser-only APIs (window, document, localStorage)
// 3. Event handlers (onClick, onSubmit)
// 4. Custom hooks that use those
// 5. Context consumers
```

---

## UI Primitives (PLANNED)

### Button
```typescript
// frontend/src/components/ui/Button.tsx (PLANNED)
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

// Usage examples:
<Button variant="primary" size="lg" onClick={handleStart}>
  Start Offer
</Button>

<Button variant="danger" size="sm" loading>
  Deleting...
</Button>
```

### Input
```typescript
// frontend/src/components/ui/Input.tsx (PLANNED)
interface InputProps {
  label: string;
  error?: string;
  helperText?: string;
  // ... standard HTML input props
}
```

### Card
```typescript
// frontend/src/components/ui/Card.tsx (PLANNED)
// Used across Dashboard, Offers, Wallet
interface CardProps {
  title?: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}
```

### Badge
```typescript
// frontend/src/components/ui/Badge.tsx (PLANNED)
interface BadgeProps {
  variant: 'success' | 'warning' | 'error' | 'info' | 'default';
  children: React.ReactNode;
}
```

---

## Composite Components (PLANNED)

### BalanceCard
```typescript
// frontend/src/components/dashboard/BalanceCard.tsx
interface BalanceCardProps {
  type: 'available' | 'pending';
  amount: number;
  description: string;
}

// Usage: <BalanceCard type="available" amount={25.50} description="Ready to cash out" />
```

### OfferCard
```typescript
// frontend/src/components/offers/OfferCard.tsx
interface OfferCardProps {
  id: string;
  provider: string;
  name: string;
  description: string;
  rewardAmount: number;
  onStart: (offerId: string) => void;
  loading?: boolean;
}
```

### WalletSummary
```typescript
// frontend/src/components/wallet/WalletSummary.tsx
interface WalletSummaryProps {
  pendingBalance: number;
  availableBalance: number;
  lifetimeEarned?: number;
}
```

### WithdrawalForm
```typescript
// frontend/src/components/wallet/WithdrawalForm.tsx
interface WithdrawalFormProps {
  availableBalance: number;
  token: string;
  onSuccess: (withdrawal: any) => void;
}
```

### ReferralLink
```typescript
// frontend/src/components/referral/ReferralLink.tsx
interface ReferralLinkProps {
  referralCode: string;
}
```

### RiskBadge
```typescript
// frontend/src/components/fraud/RiskBadge.tsx
interface RiskBadgeProps {
  score: number;
  status: 'ACTIVE' | 'FROZEN' | 'SUSPENDED';
}
```

---

## Admin Components (PLANNED)

### DataTable
```typescript
// frontend/src/components/admin/DataTable.tsx
// Generic table with sorting, filtering, pagination
// Uses @tanstack/react-table
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  pagination?: {
    pageSize: number;
    pageCount: number;
    onPageChange: (page: number) => void;
  };
}
```

### StatsCard
```typescript
// frontend/src/components/admin/StatsCard.tsx
interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number; // Percentage change
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}
```

### StatusBadge
```typescript
// Colored badges for user/withdrawal/offer status
// <StatusBadge status="ACTIVE" /> -> green
// <StatusBadge status="SUSPENDED" /> -> red
```

---

## Custom Hooks

### useAuth
```typescript
// frontend/src/providers/auth-provider.tsx
const { user, token, isLoading, login, logout, updateUser } = useAuth();

// Provides:
// - user.id, user.email, user.status, user.riskScore
// - token (JWT access token for API calls)
// - login(token, refreshToken, user)
// - logout() with API call to invalidate session
// - updateUser(user)
```

### useApi (PLANNED)
```typescript
// frontend/src/lib/api/client.ts
// Axios or fetch wrapper with:
// - Automatic Authorization header from token
// - Token refresh on 401
// - Request/response logging
// - Error normalization

const api = useApi();
const data = await api.get('/wallet/balance');
```

### useWallet (PLANNED)
```typescript
// frontend/src/hooks/useWallet.ts
const { balance, transactions, withdrawals, withdraw, isLoading } = useWallet();

// Queries:
// - balance: { pendingBalance, availableBalance }
// - transactions: Transaction[]
// - withdrawals: Withdrawal[]

// Mutations:
// - withdraw(dto): Withdrawal
```

---

## File Structure (PLANNED)

```
frontend/src/
├── app/
│   ├── (public)/
│   │   ├── page.tsx             # Landing page
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (protected)/
│   │   ├── dashboard/page.tsx
│   │   ├── offers/page.tsx
│   │   └── wallet/page.tsx
│   ├── admin/
│   │   ├── page.tsx             # Admin dashboard
│   │   ├── users/page.tsx
│   │   ├── offers/page.tsx
│   │   └── withdrawals/page.tsx
│   ├── layout.tsx               # Root layout
│   └── globals.css
├── components/
│   ├── ui/                      # Primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── Modal.tsx
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── RegisterForm.tsx
│   ├── dashboard/
│   │   ├── BalanceCard.tsx
│   │   └── ReferralSection.tsx
│   ├── offers/
│   │   ├── OfferCard.tsx
│   │   └── OfferFilters.tsx
│   ├── wallet/
│   │   ├── WithdrawalForm.tsx
│   │   └── TransactionList.tsx
│   └── admin/
│       ├── DataTable.tsx
│       ├── StatsCard.tsx
│       └── ActionModal.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useWallet.ts
│   ├── useOffers.ts
│   └── useReferrals.ts
├── lib/
│   ├── api.ts                   # API client
│   ├── utils.ts                 # Formatters, helpers
│   └── constants.ts             # Config, enums
└── providers/
    ├── AuthProvider.tsx
    ├── QueryProvider.tsx
    └── ThemeProvider.tsx
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*