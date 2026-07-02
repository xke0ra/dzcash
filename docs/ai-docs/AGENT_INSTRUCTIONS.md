# AI Agent Instructions - DZCASH Project

> **Purpose**: Enable AI agents (opencode, Cursor, GitHub Copilot, etc.) to work effectively on this codebase without guessing.

---

## Core Principles

1. **Read Context First** - Always read `PROJECT_CONTEXT.md` before starting any task
2. **Follow Development Rules** - `DEVELOPMENT_RULES.md` is law - no exceptions
3. **Use Existing Patterns** - Don't invent new patterns; extend existing ones
4. **Test Before Commit** - Run `lint`, `typecheck`, and `test` before considering work done
5. **Document Decisions** - Update `architecture/DECISION_LOG.md` for architectural choices

---

## Codebase Navigation Map

### Entry Points
```
Backend:  backend/src/main.ts -> backend/src/app.module.ts
Frontend: frontend/src/app/layout.tsx -> frontend/src/app/page.tsx
Database: backend/prisma/schema.prisma (source of truth)
Config:   docker-compose.yml, .env, nginx/default.conf
```

### Module Structure (Backend)
```
backend/src/<module>/
├── dto/              # Class-validator DTOs
├── guards/           # Custom guards
├── strategies/       # Passport strategies
├── providers/        # External service adapters
├── <module>.service.ts    # Business logic (single responsibility)
├── <module>.controller.ts # HTTP endpoints only
├── <module>.module.ts     # NestJS module definition
└── index.ts          # Barrel export
```

### Frontend Structure (Next.js App Router)
```
frontend/src/app/
├── (auth)/           # Route group: login, register
├── (dashboard)/      # Route group: dashboard, offers, wallet
├── admin/            # Admin pages (protected)
├── api/              # API routes (proxy to backend)
├── providers/        # React Context providers
├── components/       # Shared UI components
├── lib/              # Utilities, API client
├── hooks/            # Custom React hooks
└── globals.css       # Tailwind + custom styles
```

---

## Essential Commands

### Backend (run from `backend/`)
```bash
npm run build           # Compile TypeScript
npm run start:dev       # Watch mode development
npm run lint            # ESLint + Prettier check
npm run test            # Jest unit tests
npm run test:e2e        # E2E tests
npm run prisma:generate # Generate Prisma Client
npm run prisma:migrate  # Run migrations
npm run prisma:studio   # Database GUI
```

### Frontend (run from `frontend/`)
```bash
npm run dev             # Next.js dev server
npm run build           # Production build
npm run start           # Production server
npm run lint            # Next.js lint
```

### Full Stack (from root)
```bash
docker compose up --build    # Full stack with PostgreSQL, Redis, Nginx
docker compose down -v       # Stop and remove volumes
```

---

## Red Lines (Never Do)

| Forbidden | Correct Approach |
|-----------|------------------|
| Modify Prisma schema without migration | `npx prisma migrate dev --name <description>` |
| Add dependencies without justification | Check existing deps first; document why needed |
| Skip error handling | Use NestJS HttpException subclasses only |
| Use `any` in TypeScript | Strict mode enabled - fix types properly |
| Write raw SQL | Use Prisma Client; raw only for complex analytics |
| Commit without tests | New logic requires unit + integration tests |
| Hardcode secrets | Use `.env` and Docker secrets only |
| Ignore CORS in production | Configure `FRONTEND_URL` in env |
| Create new patterns | Extend existing module/service/controller pattern |

---

## How to Read This Codebase

### For New Features
1. Check `architecture/MODULE_MAP.md` - which module owns this?
2. Read existing similar feature in that module
3. Follow the exact same pattern (DTO -> Service -> Controller -> Module)
4. Add tests following `testing/UNIT_TEST_PATTERNS.md`

### For Bug Fixes
1. Check `domain/` docs for business logic (Wallet, Fraud, Tracking)
2. Trace the flow: Controller -> Service -> Prisma -> Database
3. Check `FRAUD_ENGINE.md` or `WALLET_LOGIC.md` for invariants
4. Write regression test first

### For Refactoring
1. Read `DEVELOPMENT_RULES.md` for patterns
2. Check `architecture/DECISION_LOG.md` for why current design exists
3. Ensure all tests pass before and after
4. Update documentation if interfaces change

---

## Key Domain Concepts (Must Understand)

### Dual Balance Wallet System
```
Wallet {
  pendingBalance:   // Unverified earnings (awaiting postback verification)
  availableBalance: // Settled funds ready for withdrawal
}
```
**Never calculate balances in memory** - Use Prisma `increment`/`decrement` inside `$transaction`.

### Risk Scoring (Fraud Engine)
| Score Range | Status | Restrictions |
|-------------|--------|--------------|
| 0-69 | ACTIVE | None |
| 70-84 | FROZEN | No withdrawals, offers work |
| 85-100 | SUSPENDED | No login, no offers, no withdrawals |

Triggers: VPN (+45), Fingerprint Clones (+25 each, max +50), Velocity >15/5min (+30), Geo Inconsistency (+40)

### Offer Tracking Flow
```
Click (GET /tracking/click) -> Click record (CLICKED) -> Redirect URL with {click_id}
                                    |
User completes offer on advertiser site
                                    |
Postback (GET/POST /tracking/postback/:provider) -> Signature validation -> Fraud checks
                                    |
Atomic transaction: Click->CONVERTED, Wallet+=reward, Transaction=PENDING, Referral+=10%
```

### Referral System
- 10% lifetime commission on referred user's conversions
- Paid instantly to `availableBalance` (not pending)
- Referral code: 6-char uppercase, unique

---

## Documentation Hierarchy (Read in Order)

1. **PROJECT_CONTEXT.md** - What is this project? Current state? Goals?
2. **DEVELOPMENT_RULES.md** - Strict coding standards
3. **architecture/SYSTEM_OVERVIEW.md** - System architecture
4. **architecture/MODULE_MAP.md** - Module dependencies
5. **domain/WALLET_LOGIC.md** - Financial operations (critical)
6. **domain/FRAUD_ENGINE.md** - Security logic
7. **domain/TRACKING_ENGINE.md** - Core business flow
8. **Module-specific docs** in `modules/<module>/` for deep dives

---

## AI-Specific Tips

### When Generating Code
```typescript
// Good: Follow existing pattern exactly
@Injectable()
export class NewService {
  constructor(private prisma: PrismaService) {}
  
  async doThing(dto: DoThingDto) {
    return this.prisma.$transaction(async (tx) => {
      // Atomic operations with increment/decrement
    });
  }
}

// Bad: Inventing new patterns
export class NewService {
  async doThing() { /* raw SQL, no transaction, memory calc */ }
}
```

### When Answering Questions
- Reference file paths: `backend/src/wallet/wallet.service.ts:45`
- Cite documentation: "Per `domain/WALLET_LOGIC.md`..."
- Show existing patterns: "Similar to `TrackingService.handlePostback()`..."

### Context Window Management
- Read only relevant module docs for the task
- Don't load entire codebase unless necessary
- Use `grep` to find patterns before writing

---

## Quick Reference Links

| Document | Purpose |
|----------|---------|
| `PROJECT_CONTEXT.md` | Full project context for new sessions |
| `DEVELOPMENT_RULES.md` | Coding standards and patterns |
| `architecture/SYSTEM_OVERVIEW.md` | System architecture diagram |
| `architecture/MODULE_MAP.md` | Module dependency graph |
| `domain/WALLET_LOGIC.md` | Wallet operations reference |
| `domain/FRAUD_ENGINE.md` | Fraud detection specs |
| `domain/TRACKING_ENGINE.md` | Click-to-conversion flow |
| `testing/TEST_STRATEGY.md` | Testing approach |
| `api/ENDPOINT_CATALOG.md` | All API endpoints |

---

## Update Protocol

When you make changes:
1. Update relevant `.md` files in `docs/ai-docs/`
2. Add entry to `architecture/DECISION_LOG.md` for architectural changes
3. Update `CHANGELOG.md` with version, date, changes
4. Ensure code examples in docs match actual implementation

---

*Last Updated: 2026-07-02 | Version: 1.0.0*