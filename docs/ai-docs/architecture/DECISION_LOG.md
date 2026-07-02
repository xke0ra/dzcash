# Architecture Decision Records (ADR) - DZCASH

> **Purpose**: Record architectural decisions, context, and consequences for AI agents and developers.

---

## ADR Format

Each record follows:
```
## ADR-{NNN}: {Title}

**Status:** [Proposed | Accepted | Deprecated | Superseded]
**Date:** {YYYY-MM-DD}
**Decision-Maker:** {Person/Role}

### Context
{Why this decision was needed}

### Decision
{What was decided}

### Consequences
{What this means for the project}
```

---

## ADR-001: NestJS Framework Selection

**Status:** Accepted
**Date:** 2026-06-15
**Decision-Maker:** Project Lead

### Context
Needed a backend framework that supports TypeScript, dependency injection, modular architecture, and has strong ecosystem for building REST APIs.

### Decision
Chose **NestJS 10.x** because:
- Built-in dependency injection (Angular-like)
- Modular architecture (Modules/Services/Controllers)
- First-class support for Prisma, Passport, JWT
- Decorator-based validation (class-validator)
- Swagger/OpenAPI support built-in
- Strong TypeScript support

### Consequences
- Fast development with decorators and DI
- Consistent project structure across all modules
- Easy to add guards, interceptors, pipes
- Larger bundle size compared to Express raw
- Steeper learning curve for non-Angular developers

---

## ADR-002: Prisma ORM with PostgreSQL

**Status:** Accepted
**Date:** 2026-06-15
**Decision-Maker:** Project Lead

### Context
Required an ORM with strong TypeScript support, migration system, and connection pooling for financial transactions.

### Decision
Chose **Prisma 5.x** with **PostgreSQL 15** because:
- Type-safe database access (generated types)
- Declarative schema with migrations
- ACID-compliant for financial operations
- Native `$transaction` support
- Excellent for complex queries with relations

### Consequences
- Database schema is source of truth
- Zero raw SQL in codebase (except complex analytics)
- TypeScript types auto-generated, no duplication
- Migration files are version-controlled
- Row-level locks inside `$transaction` for wallet operations

---

## ADR-003: Dual Balance Wallet System

**Status:** Accepted
**Date:** 2026-06-15
**Decision-Maker:** Project Lead

### Context
Users need to see their earnings immediately, but platform needs time to verify conversions (fraud check, chargeback window).

### Decision
Implemented **Dual Balance System** (`pendingBalance` + `availableBalance`):
- `pendingBalance`: Earnings that are verified but awaiting admin settlement
- `availableBalance`: Settled funds ready for withdrawal

### Consequences
- Users see earnings immediately (pending)
- Platform has time for fraud review
- Admin settlement is required before withdrawal
- More complex wallet operations (settle, reverse)
- Clear separation of concerns between verification and availability

---

## ADR-004: Atomic Wallet Operations with $transaction

**Status:** Accepted
**Date:** 2026-06-15
**Decision-Maker:** Project Lead

### Context
Wallet balance must never be incorrect due to race conditions (multiple postbacks, concurrent withdrawals).

### Decision
All wallet operations MUST use Prisma `$transaction` with `increment`/`decrement`:
- Never calculate balance in memory
- Never set absolute balance values
- Use row-level locking via `$transaction`

### Consequences
- Bank-grade financial integrity
- No race conditions even under high concurrency
- Slightly slower than in-memory operations
- Code is more verbose but safer
- Serial transaction isolation prevents double-spend

---

## ADR-005: Adapter Pattern for Offer Providers

**Status:** Accepted
**Date:** 2026-06-15
**Decision-Maker:** Project Lead

### Context
Multiple offer providers (CPX, OfferToro, etc.) with different API formats, signature schemes, and data formats.

### Decision
Implemented **Adapter Pattern** with `OfferProviderInterface`:
```typescript
interface OfferProviderInterface {
  getProviderName(): string;
  validatePostback(query, headers, body): Promise<boolean>;
  extractPostbackData(query, body): PostbackData;
}
```

### Consequences
- Adding new provider = implement interface
- Consistent postback handling across providers
- Each provider encapsulates its own signature logic
- Easy to test each provider in isolation
- Slight overhead of adapter abstraction

---

## ADR-006: Fraud Detection with Risk Scoring

**Status:** Accepted
**Date:** 2026-06-15
**Decision-Maker:** Project Lead

### Context
GPT platforms are prime targets for fraud (VPN abuse, multi-accounting, click bots). Needed automated detection.

### Decision
Implemented **Risk Scoring System** (0-100):
- Multiple triggers weighted by severity
- Automatic status changes at thresholds (70=FROZEN, 85=SUSPENDED)
- Detailed FraudLog for audit trail
- Mock VPN detection ready for real API integration

### Consequences
- Most fraud handled automatically without admin intervention
- Users understand their risk score
- FraudLog provides evidence for manual review
- Testing requires mock data for various scenarios
- Thresholds may need tuning based on real usage

---

## ADR-007: JWT with Refresh Token Rotation

**Status:** Accepted
**Date:** 2026-06-15
**Decision-Maker:** Project Lead

### Context
Need secure authentication that supports session management and protects against token theft.

### Decision
Implemented **JWT Access/Refresh with Rotation**:
- Access Token: 15 minutes (short-lived)
- Refresh Token: 7 days (stored in DB, rotated on each use)
- Session table tracks IP and UserAgent
- Logout invalidates refresh token

### Consequences
- Short-lived access tokens limit exposure
- Refresh token rotation prevents replay attacks
- Session tracking helps fraud detection
- More complex than simple JWT
- Requires database lookup on every refresh

---

## ADR-008: Next.js 14 App Router

**Status:** Accepted
**Date:** 2026-06-15
**Decision-Maker:** Project Lead

### Context
Needed a React framework with SSR, file-based routing, and strong TypeScript support.

### Decision
Chose **Next.js 14 App Router** because:
- Server Components by default (better performance)
- File-based routing (no React Router config)
- API routes can proxy to backend
- Built-in image optimization
- React Server Components for i18n

### Consequences
- Faster initial page loads (SSR)
- Smaller client bundles (Server Components)
- Routes mirror file structure
- App Router is relatively new (some patterns still evolving)
- 'use client' directive needed for interactive components

---

## ADR-009: next-intl for Internationalization

**Status:** Accepted
**Date:** 2026-07-02
**Decision-Maker:** Project Lead

### Context
Platform targets Arabic-speaking users but needs English support too. Requires RTL layout and full i18n.

### Decision
Chose **next-intl** because:
- Native App Router support
- Server Component compatible
- Built-in RTL support
- File-based messages (JSON)
- Type-safe translations (planned)

### Consequences
- Translations in JSON files (ar.json, en.json)
- Locale routing (`/ar/dashboard`, `/en/dashboard`)
- RTL support via `dir` attribute + Tailwind
- All UI texts must use translation keys
- Initial setup requires middleware and configuration

---

## ADR-010: Vitest + Playwright for Testing

**Status:** Accepted
**Date:** 2026-07-02
**Decision-Maker:** Project Lead

### Context
Need fast unit tests and reliable E2E tests for a financial platform.

### Decision
Chose **Vitest** for unit tests + **Playwright** for E2E:
- Vitest: faster than Jest, native TypeScript, ES module support
- Playwright: multi-browser, reliable selectors, network mocking

### Consequences
- Unit tests run 2-3x faster than Jest
- Vitest can import Jest configs (migration path)
- Playwright covers Chrome, Firefox, Safari
- E2E tests are more reliable than Cypress
- Two testing frameworks to manage

---

## ADR-011: Admin Role in Same Users Table

**Status:** Proposed
**Date:** 2026-07-02
**Decision-Maker:** Pending

### Context
Need admin access control. Options: separate admin table, role in users table, or email-based check.

### Decision
Proposed adding `role` field to existing `User` model:
```prisma
enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}

model User {
  ...
  role UserRole @default(USER)
}
```

### Consequences
- Single authentication flow for all users
- Guard checks role instead of email
- Admin registration still separate (no public admin signup)
- Migration required to add role field
- Row Level Security not needed (NestJS guards suffice)

---

## ADR-012: SSE for Real-time Notifications

**Status:** Proposed
**Date:** 2026-07-02
**Decision-Maker:** Pending

### Context
Users need real-time updates (balance changes, withdrawal status). Options: SSE, WebSocket (Socket.io), or polling.

### Decision
Proposed **Server-Sent Events (SSE)** because:
- Simpler than WebSocket (HTTP protocol)
- Works with Nginx proxying
- Auto-reconnect built-in
- One-way (server to client) is sufficient
- Lower overhead than polling

### Consequences
- Real-time balance updates
- Withdrawal status notifications
- Works behind Nginx
- Not suitable for bidirectional communication
- Browser support is good but not universal (IE)

---

## ADR-013: Non-Custodial Crypto Withdrawals

**Status:** Proposed
**Date:** 2026-07-02
**Decision-Maker:** Pending

### Context
Users want crypto withdrawals. Options: custodial (we hold keys) vs non-custodial (user provides address).

### Decision
Proposed **Non-Custodial Model**:
- Users provide their own wallet addresses
- Platform sends payments to provided addresses
- No private keys stored on platform
- Lower regulatory risk

### Consequences
- No crypto key management
- Users responsible for correct addresses
- Platform needs integration with exchange or payment processor
- Lower risk for platform
- USDT on TRC20/BEP20 as primary option

---

*Last Updated: 2026-07-02 | Version: 1.0.0*