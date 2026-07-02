# Project Context - DZCASH

> **Purpose**: Complete project context for AI agents starting new sessions. Read this first.

---

## What is DZCASH?

DZCASH is a **GPT (Get-Paid-To) rewards platform** similar to FreeCash.com. Users complete offers (surveys, app installs, signups) from integrated offerwalls and earn real money withdrawable via PayPal, Crypto, or Gift Cards.

**Target Market**: Arabic-speaking users (Algeria, Morocco, Tunisia, etc.) with full RTL support and Arabic/English i18n.

---

## Current State (as of 2026-07-02)

### Backend (NestJS + Prisma + PostgreSQL) - **Core Modules Complete**
| Module | Status | Description |
|--------|--------|-------------|
| Auth | ✅ Complete | JWT + Refresh tokens, session management, bcrypt |
| Users | ✅ Complete | Profile, referrals, user management |
| Wallet | ✅ Complete | Dual balance (pending/available), transactions, withdrawals |
| Offers | ✅ Complete | Offer management, 3 provider adapters (CPX, OfferToro, Generic) |
| Tracking | ✅ Complete | Click tracking, S2S postbacks, fraud checks |
| Fraud | ✅ Complete | Risk scoring (VPN, fingerprint, velocity, geo), auto-penalties |
| Admin | ⚠️ **Empty** | Only guards exist - needs full implementation |
| Prisma | ✅ Complete | Database service and module |

### Frontend (Next.js 14 App Router + Tailwind + TanStack Query) - **Basic Pages Done**
| Page | Status | Description |
|------|--------|-------------|
| Landing | ✅ Complete | Marketing page with features |
| Login | ✅ Complete | Email/password authentication |
| Register | ✅ Complete | Registration with referral code |
| Dashboard | ✅ Complete | Balance, referrals, risk score |
| Offers | ✅ Complete | Offer listing, click tracking |
| Wallet | ⚠️ **Basic** | Balance display only - no withdrawal form |
| Admin | ⚠️ **Placeholder** | Empty page |

### Infrastructure - **Production Ready**
- Docker Compose: PostgreSQL 15, Redis 7, Backend, Frontend, Nginx
- Multi-stage Docker builds for backend and frontend
- Nginx reverse proxy routing `/api/*` to backend, `/*` to frontend
- Environment configuration via `.env` and Docker Compose

### Missing Critical Features
| Feature | Status | Priority |
|---------|--------|----------|
| Admin Panel | ❌ Not started | 🔴 Critical |
| Email/Notifications | ❌ Not started | 🔴 Critical |
| Offer Sync (Real APIs) | ❌ Mock only | 🔴 Critical |
| Tests (Unit/E2E) | ❌ Zero tests | 🔴 Critical |
| i18n (Arabic/English + RTL) | ❌ Not started | 🔴 Critical |
| Crypto Payouts | ❌ Not implemented | 🟡 High |
| KYC/Compliance | ❌ Not implemented | 🟡 High |
| Monitoring/Observability | ❌ Basic only | 🟡 High |

---

## Tech Stack

### Backend
```
NestJS 10.x          # Framework
TypeScript 5.x       # Language
Prisma 5.x           # ORM
PostgreSQL 15        # Database
Redis 7              # Cache/Sessions
JWT + Passport       # Authentication
bcrypt               # Password hashing
class-validator      # Validation
ioredis              # Redis client
```

### Frontend
```
Next.js 14 (App Router)  # Framework
React 18                 # UI Library
TypeScript 5.x           # Language
Tailwind CSS 3.x         # Styling
TanStack Query 5.x       # Server State
next-intl (planned)      # i18n
lucide-react             # Icons
```

### DevOps
```
Docker + Docker Compose  # Containerization
Nginx                    # Reverse Proxy
GitHub Actions (planned) # CI/CD
Prometheus + Grafana (planned) # Monitoring
```

---

## Project Goals (3-Month Roadmap)

### Month 1: Foundation & Admin
- [ ] Security hardening (CORS, rate limiting, secrets)
- [ ] i18n system (Arabic/English + RTL)
- [ ] Complete Admin Panel (users, offers, withdrawals, fraud review)
- [ ] Email service integration
- [ ] CI/CD pipeline

### Month 2: Real Integrations
- [ ] CPX Research API integration (offer sync, postback)
- [ ] OfferToro API integration (offer sync, postback)
- [ ] Cron jobs for offer synchronization
- [ ] Webhook endpoints for real-time updates
- [ ] Crypto withdrawal implementation

### Month 3: Polish & Launch
- [ ] Complete frontend (Wallet, KYC, Referral Dashboard)
- [ ] Comprehensive testing (unit, integration, E2E, load)
- [ ] Monitoring, alerting, logging
- [ ] Production deployment
- [ ] Legal pages (ToS, Privacy, Cookie Policy)

---

## Key Business Rules

### Revenue Model
- **Margin**: Platform keeps difference between `payoutAmount` (advertiser pays) and `rewardAmount` (user gets)
- Typical margin: 20-30% (e.g., advertiser pays $1.20, user gets $0.90)

### Referral System
- 10% lifetime commission on all referred user conversions
- Paid instantly to referrer's `availableBalance`
- No cap on earnings

### Fraud Protection
- Risk score 0-100, updated on every click and postback
- ≥70: FROZEN (no withdrawals)
- ≥85: SUSPENDED (no login, no activity)
- Triggers: VPN, device clones, velocity, geo inconsistency

### Withdrawal Methods
- PayPal (email)
- Crypto (USDT TRC20/ERC20/BEP20 - planned)
- Gift Cards (planned)
- Minimum withdrawal: $5 (configurable)
- Admin approval required for all withdrawals

---

## Database Schema Highlights

### Core Models
```
User <-> Wallet (1:1)
User <-> Session (1:N)           # Refresh tokens
User <-> Click (1:N)             # Offer clicks
User <-> Transaction (1:N)       # Financial ledger
User <-> Withdrawal (1:N)        # Payout requests
User <-> FraudLog (1:N)          # Security audit
User <-> User (self-ref)         # Referrals (10% commission)

Offer (CPX/OfferToro/Generic) <-> Click (1:N)
Click <-> Transaction (1:1)      # Conversion tracking
Withdrawal <-> Transaction (1:1)
```

### Critical Enums
```
UserStatus: ACTIVE | SUSPENDED | FROZEN
OfferProvider: CPX | OFFERTORO | GENERIC
ClickStatus: CLICKED | CONVERTED | REJECTED
TransactionType: OFFER_CONVERSION | WITHDRAWAL | REFERRAL_BONUS | FRAUD_REVERSAL
TransactionStatus: PENDING | COMPLETED | REVERSED | REJECTED
WithdrawalMethod: PAYPAL | CRYPTO | GIFT_CARD
WithdrawalStatus: PENDING | APPROVED | REJECTED | FAILED
FraudTriggerType: VPN_DETECTED | IP_MISMATCH | HIGH_VELOCITY | DEVICE_FINGERPRINT_CLONE | GEO_INCONSISTENCY
```

---

## Security Model

### Authentication
- JWT Access Tokens: 15 minutes
- JWT Refresh Tokens: 7 days (stored in DB, rotated on use)
- Bcrypt password hashing (cost: 10)
- Session tracking with IP + UserAgent

### Postback Security
- CPX: HMAC-SHA256 of `click_id:payout:status`
- OfferToro: MD5 of `o_id:click_id:secret`
- Generic: Pre-shared token validation
- Timing-safe comparison for HMAC

### Fraud Detection
- VPN/Proxy detection (mock + ready for IPQualityScore)
- Device fingerprint cloning detection
- Click velocity limiting (15 clicks/5min)
- Geo IP inconsistency (click IP vs postback IP)

---

## File Structure Reference

```
dzcash/
├── backend/
│   ├── prisma/schema.prisma       # Database schema (source of truth)
│   ├── src/
│   │   ├── auth/                  # Authentication module
│   │   ├── users/                 # User management
│   │   ├── wallet/                # Wallet & withdrawals
│   │   ├── offers/                # Offer management + providers
│   │   ├── tracking/              # Click tracking + postbacks
│   │   ├── fraud/                 # Fraud detection
│   │   ├── admin/                 # Admin panel (empty)
│   │   └── prisma/                # Prisma service
│   └── Dockerfile
├── frontend/
│   ├── src/app/                   # Next.js App Router pages
│   ├── src/providers/             # React Context providers
│   └── Dockerfile
├── nginx/default.conf             # Reverse proxy config
├── docker-compose.yml             # Full stack orchestration
├── .env                           # Environment variables
└── docs/ai-docs/                  # AI-optimized documentation (this folder)
```

---

## Environment Variables (Key)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `JWT_SECRET` | Access token signing secret | Yes |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | Yes |
| `FRONTEND_URL` | CORS origin for frontend | Yes |
| `CPX_SECRET` | CPX postback HMAC secret | Yes |
| `OFFERTORO_SECRET` | OfferToro postback MD5 secret | Yes |
| `GENERIC_PROVIDER_TOKEN` | Generic provider token | Yes |
| `VPN_API_MOCK` | Enable mock VPN detection | No (dev) |

---

## API Base URLs

| Environment | Frontend | Backend API | Nginx Proxy |
|-------------|----------|-------------|-------------|
| Local | http://localhost:3000 | http://localhost:4000/api | http://localhost |
| Docker | http://localhost:3000 | http://localhost:4000/api | http://localhost |
| Staging | TBD | TBD | TBD |
| Production | TBD | TBD | TBD |

---

## Team Conventions

### Git
- **Branches**: `feat/<short-desc>`, `fix/<short-desc>`, `refactor/<short-desc>`
- **Commits**: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`)
- **PR Required**: Lint + TypeCheck + Tests pass

### Code Style
- TypeScript `strict: true`
- ESLint + Prettier (configured)
- No `any` types
- Explicit return types for public methods
- Prisma `$transaction` for multi-step operations

### Documentation
- Update `docs/ai-docs/` with every change
- Code examples must match implementation
- Cross-reference with `file://` relative paths

---

## Quick Start for New Developers

```bash
# 1. Clone and configure
cp .env.example .env  # Edit with your values

# 2. Start full stack
docker compose up --build

# 3. Access
3. Access
   - Frontend: http://localhost
   - API: http://localhost/api
   - API Direct: http://localhost:4000/api
   - Prisma Studio: cd backend && npm run prisma:studio

# 4. Run tests (when implemented)
cd backend && npm run test
cd frontend && npm run test
```

---

## Known Technical Debt

1. **Admin Guard**: Uses hardcoded email check (`admin@dzcash.com`) - needs role-based system
2. **CORS**: Currently `origin: '*'` - must restrict to `FRONTEND_URL` in production
3. **Secrets**: Hardcoded in `docker-compose.yml` - must use Docker secrets
4. **Offer Sync**: Only mock data - no real API integration
5. **Tests**: Zero test coverage
6. **Session Cleanup**: No cron for expired sessions
7. **Rate Limiting**: Not implemented
8. **Email**: No email service at all
9. **i18n**: English only, no RTL support

---

*Last Updated: 2026-07-02 | Version: 1.0.0*