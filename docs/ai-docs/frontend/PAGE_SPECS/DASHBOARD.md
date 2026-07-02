# Page Specifications - DZCASH Frontend

> **Purpose**: Complete specifications for each page in the application.

---

## Page: Dashboard (`/dashboard`)

**Route:** `app/[locale]/dashboard/page.tsx`
**Type:** Client Component (interactive)
**Auth:** Required

### Sections
1. **Header Panel**: Welcome message, user status badge, risk score badge
2. **Balance Ledger**: Available balance + Pending balance cards
3. **Referral Section**: Referral link with copy button, stats
4. **Referral List**: Table of referred users

### Data Dependencies
```typescript
GET /api/users/me        -> ProfileData { id, email, status, riskScore, referralCode, wallet }
GET /api/users/referrals -> ReferralData[] { id, email, status, createdAt }
```

### States
```typescript
interface DashboardState {
  loading: boolean;
  error: string | null;
  profile: ProfileData | null;
  referrals: ReferralData[];
}
```

### User Flows
1. **New user**: See empty state with "No referrals yet" + copy referral link
2. **Active user**: See balances, referrals list, status
3. **Suspended user**: See account restrictions, limited information
4. **Error**: 401 redirect to login, network error with retry

---

## Page: Offers (`/offers`)

**Route:** `app/[locale]/offers/page.tsx`
**Type:** Client Component
**Auth:** Required

### Sections
1. **Page Header**: Title + description
2. **Offer Grid**: Cards for each active offer
3. **Error/Success Messages**: Status alerts

### Data Dependencies
```typescript
GET /api/offers -> OfferData[] { id, provider, name, description, payoutAmount, rewardAmount }
```

### States
```typescript
interface OffersState {
  loading: boolean;
  error: string | null;
  offers: OfferData[];
  clickLoading: string | null; // Currently loading offer ID
}
```

### User Flows
1. **View offers**: See grid of available offers sorted by reward
2. **Start offer**: Click "Start" -> loading state -> new tab opens
3. **Error**: Network error, account flagged, offer unavailable

### Future Enhancements
- [ ] Offer detail view (modal or page)
- [ ] Search/filter by provider, category, reward
- [ ] Offer completion status per user
- [ ] Favorite/bookmark offers

---

## Page: Wallet (`/wallet`)

**Route:** `app/[locale]/wallet/page.tsx`
**Type:** Client Component
**Auth:** Required

### Sections
1. **Balance Overview**: Available + Pending + Lifetime earned
2. **Withdrawal Form**: Method selector, amount input, details
3. **Withdrawal History**: Table of past withdrawals
4. **Transaction History**: Table of all transactions

### Data Dependencies
```typescript
GET /api/wallet/balance       -> { pendingBalance, availableBalance }
GET /api/wallet/transactions  -> Transaction[]
GET /api/wallet/withdrawals   -> Withdrawal[]
```

### States
```typescript
interface WalletState {
  loading: boolean;
  error: string | null;
  balance: { pendingBalance: number; availableBalance: number };
  transactions: Transaction[];
  withdrawals: Withdrawal[];
  formState: 'idle' | 'submitting' | 'success' | 'error';
}
```

### User Flows
1. **View balance**: See available/pending amounts
2. **Request withdrawal**: Fill form -> submit -> confirmation
3. **View history**: Scroll through past withdrawals/transactions
4. **Error**: Insufficient balance, invalid details, account frozen

### Future Enhancements
- [ ] Real-time balance updates via SSE
- [ ] Export to CSV
- [ ] Withdrawal success/failure notifications
- [ ] Save withdrawal methods for reuse

---

## Page: Admin (`/admin`)

**Route:** `app/[locale]/admin/page.tsx`
**Type:** Client Component
**Auth:** Required (Admin role)

### Section: Dashboard
- **KPIs**: Total users, new users (today), total offers completed, pending withdrawals, total payout (today), fraud alerts (24h), revenue

**Data:**
```typescript
GET /api/admin/stats -> AdminStats
```

### Section: Users
- **Table**: ID, Email, Status, Risk Score, Balance, Registration date
- **Actions**: View details, Suspend/Unsuspend, Freeze/Unfreeze, Override risk score
- **Search**: By email, status, risk range
- **Pagination**: 25 per page

**Data:**
```typescript
GET /api/admin/users?page=1&limit=25&status=&search=
PATCH /api/admin/users/:id/status  -> { status, reason }
```

### Section: Offers
- **Table**: Name, Provider, Payout, Reward, Status, Last sync
- **Actions**: Create, Edit, Toggle active/inactive, Sync from provider
- **Sync modal**: Triggers manual sync, shows results

**Data:**
```typescript
GET  /api/admin/offers -> Paginated<Offer>
POST /api/admin/offers -> Create offer
PATCH /api/admin/offers/:id -> Update offer
POST /api/admin/offers/sync/:provider -> SyncResult
```

### Section: Withdrawals
- **Queue**: Unprocessed withdrawals first, sorted by date (oldest first)
- **Table**: ID, User email, Method, Amount, Status, Date
- **Actions**: Approve (with confirmation), Reject (with reason input)
- **Bulk actions**: Select multiple, approve/reject all

**Data:**
```typescript
GET  /api/admin/withdrawals?status=PENDING
POST /api/admin/withdrawals/:id/approve
POST /api/admin/withdrawals/:id/reject  -> { reason }
```

### Section: Fraud
- **Queue**: Unreviewed fraud logs, sorted by date (newest first)
- **Table**: ID, User email, Trigger type, Score, Details, Date
- **Actions**: Sustain (keep penalty), Dismiss (remove score), View user

**Data:**
```typescript
GET  /api/admin/fraud?reviewed=false
POST /api/admin/fraud/:id/review -> { action: 'dismiss' | 'sustain', notes }
```

### Future Enhancements
- [ ] Charts for revenue, user growth, conversion rates
- [ ] Audit log viewer
- [ ] Email notification triggers
- [ ] Export data (CSV/PDF)
- [ ] Role management

---

## Page: Login (`/login`)

**Route:** `app/[locale]/login/page.tsx`
**Type:** Client Component
**Auth:** No (redirect if already logged in)

### Form Fields
- Email (required, email format)
- Password (required, min 6 characters)

### States
- **Idle**: Form ready
- **Submitting**: Loading spinner on button
- **Error**: Invalid credentials, suspended account, network error
- **Success**: Redirect to /dashboard

### Redirects
- Already logged in: Redirect to /dashboard
- After login: Redirect to return URL (or /dashboard)

---

## Page: Register (`/register`)

**Route:** `app/[locale]/register/page.tsx`
**Type:** Client Component
**Auth:** No (redirect if already logged in)

### Form Fields
- Email (required, email format)
- Password (required, min 6 characters)
- Confirm Password (required, must match)
- Referral Code (optional, auto-filled from URL `?ref=CODE`)

### States
- **Idle**: Form ready (referral pre-filled from URL)
- **Submitting**: Loading spinner on button
- **Error**: Email already exists, invalid referral code, validation errors
- **Success**: Auto-login, redirect to /dashboard

### URL Parameters
```
/register                    -> Register without referral
/register?ref=ABCDEF         -> Register with referral code pre-filled
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*