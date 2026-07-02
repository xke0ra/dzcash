# Development Rules - DZCASH

> **Purpose**: Strict coding standards that ALL AI agents and developers must follow. No exceptions.

---

## 1. Backend Architecture Rules (NestJS)

### 1.1 Module Structure (MANDATORY)
Every module in `backend/src/<module>/` MUST follow:
```
module/
├── dto/           # class-validator DTOs (one file per DTO)
├── guards/        # Custom NestJS guards
├── strategies/    # Passport strategies (if auth-related)
├── providers/     # External service adapters
├── <module>.service.ts    # Business logic only
├── <module>.controller.ts # HTTP layer only
├── <module>.module.ts     # NestJS module definition
└── index.ts       # Barrel export
```

### 1.2 Service Layer Rules
```typescript
// CORRECT: Single responsibility, Prisma transactions
@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async doOperation(dto: OperationDto): Promise<ResultType> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate
      // 2. Read current state
      // 3. Modify with increment/decrement
      // 4. Return result
    });
  }
}

// WRONG: Multiple responsibilities, no transaction
@Injectable()
export class WalletService {
  async doOperation(dto: any) { // never use 'any'
    // logic scattered across methods
  }
}
```

### 1.3 Controller Layer Rules
```typescript
// CORRECT: Thin controllers, delegate to service
@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getBalance(@Req() req: AuthenticatedRequest) {
    return this.walletService.getBalance(req.user.id);
  }
}

// WRONG: Business logic in controller
@Controller('wallet')
export class WalletController {
  @Get('balance')
  async getBalance(@Req() req) {
    // logic here - NO
  }
}
```

### 1.4 DTO Rules
```typescript
// CORRECT: Full validation with class-validator
export class WithdrawDto {
  @IsEnum(WithdrawalMethod)
  @IsNotEmpty()
  method: WithdrawalMethod;

  @IsNumber()
  @Min(5)
  @Max(10000)
  amount: number;

  @IsObject()
  @ValidateNested()
  @Type(() => WithdrawalDetailsDto)
  details: WithdrawalDetailsDto;
}

// WRONG: No validation
export class WithdrawDto {
  method: string;
  amount: number;
}
```

---

## 2. Database Rules (Prisma)

### 2.1 Schema Modifications
```bash
# ALWAYS generate a migration when changing schema
cd backend
npx prisma migrate dev --name <descriptive-name>
npx prisma generate

# NEVER modify the database manually
# NEVER delete migration files
```

### 2.2 Query Rules
```typescript
// CORRECT: Use Prisma Client with typed queries
const user = await this.prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, email: true, status: true, riskScore: true },
});

// CORRECT: Use $transaction for multi-step operations
this.prisma.$transaction(async (tx) => {
  await tx.wallet.update({
    where: { userId },
    data: { availableBalance: { increment: amount } },
  });
  await tx.transaction.create({ data: { ... } });
});

// WRONG: Raw SQL (unless complex analytics)
await this.prisma.$queryRaw`SELECT * FROM users`;

// WRONG: select * (unless all fields needed)
const user = await this.prisma.user.findUnique({
  where: { id: userId },
});
```

### 2.3 Balance Operations (CRITICAL)
```typescript
// ALWAYS: Use increment/decrement for financial operations
data: { availableBalance: { increment: amount } }

// NEVER: Calculate in memory and set absolute value
const wallet = await prisma.wallet.findUnique({ where: { userId } });
const newBalance = wallet.availableBalance + amount; // DANGER: race condition
await prisma.wallet.update({
  where: { userId },
  data: { availableBalance: newBalance }, // WRONG
});
```

---

## 3. Frontend Rules (Next.js)

### 3.1 Component Architecture
```typescript
// Server Component by default
// pages/dashboard/page.tsx (Server Component)
async function DashboardPage() {
  const data = await fetchDashboardData();
  return <DashboardClient data={data} />;
}

// 'use client' only when needed
// components/dashboard/DashboardClient.tsx
'use client';
function DashboardClient({ data }: Props) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  // ... interactive logic
}
```

### 3.2 State Management (TanStack Query)
```typescript
// CORRECT: Use TanStack Query for server state
export function useWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => fetch('/api/wallet/balance').then(res => res.json()),
  });
}

// CORRECT: Use Auth Context for auth state only
const { user, token, login, logout } = useAuth();
```

### 3.3 API Calls
```typescript
// CORRECT: Always include auth header
const res = await fetch('/api/wallet/balance', {
  headers: { 'Authorization': `Bearer ${token}` },
});
```

---

## 4. TypeScript Rules

### 4.1 Strict Mode (ENABLED)
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 4.2 Type Definitions
```typescript
// CORRECT: Explicit types for public API
async getUser(id: string): Promise<UserProfile> {
  return this.prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, status: true },
  });
}

// WRONG: Implicit any
async getUser(id) {
  return this.prisma.user.findUnique({ where: { id } });
}
```

---

## 5. Error Handling Rules

```typescript
// CORRECT: Use NestJS HttpException subclasses
throw new NotFoundException('User not found');
throw new ConflictException('Email already registered');
throw new UnauthorizedException('Invalid credentials');
throw new BadRequestException('Insufficient balance');

// NEVER throw generic Error
throw new Error('Something went wrong');
```

---

## 6. Testing Rules (Vitest + Playwright)

```typescript
// CORRECT: Test behavior, not implementation
describe('WalletService', () => {
  it('should deduct available balance on withdrawal request', async () => {
    const wallet = await service.requestWithdrawal(userId, withdrawDto);
    // Assert: balance decreased, withdrawal created
  });
});

// WRONG: Testing implementation details
describe('WalletService', () => {
  it('should call prisma.transaction', async () => {
    // Don't test framework internals
  });
});
```

---

## 7. Git & Workflow Rules

### 7.1 Conventional Commits
```
feat: Add crypto withdrawal support
fix: Fix race condition in postback handling
docs: Update WALLET_LOGIC.md with reversal flow
test: Add unit tests for FraudService
refactor: Extract provider validation to separate method
chore: Update dependencies
```

### 7.2 Branch Naming
```
feat/admin-panel
feat/offer-sync-cron
fix/postback-signature-bug
refactor/wallet-service
```

### 7.3 PR Requirements
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] New code has unit tests
- [ ] Documentation updated in `docs/ai-docs/`

---

## 8. Security Rules (NEVER BREAK)

### 8.1 Secrets
```bash
# ALWAYS: Use environment variables
process.env.JWT_SECRET

# NEVER: Hardcode secrets
const secret = 'super-secret-key'; # NEVER
```

### 8.2 User Input
```typescript
// ALWAYS: Validate with class-validator
@IsEmail()
@IsNotEmpty()
email: string;

// ALWAYS: Sanitize with whitelist
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
```

### 8.3 Authentication
```typescript
// ALWAYS: Protect endpoints with guards
@UseGuards(JwtAuthGuard)
@Get('profile')

// ALWAYS: Use AdminGuard for admin endpoints
@UseGuards(JwtAuthGuard, AdminGuard)
@Get('admin/users')
```

---

## 9. i18n Rules (Arabic + English)

```typescript
// CORRECT: Use translation keys everywhere
function BalanceCard() {
  const t = useTranslations('dashboard');
  return (
    <div>
      <h2>{t('availableBalance')}</h2>
      <p>{t('amount', { value: balance })}</p>
    </div>
  );
}

// WRONG: Hardcoded text
function BalanceCard() {
  return (
    <div>
      <h2>Available Balance</h2> {/* Hardcoded */}
    </div>
  );
}
```

---

## 10. Dependency Rules

```bash
# BEFORE adding a dependency:
# 1. Check if existing dependency can do the job
# 2. Check bundle size impact (for frontend)
# 3. Check if it's maintained and has TypeScript types
# 4. Document why it's needed

# REQUIRED dependencies (don't add alternatives):
# Backend: @nestjs/*, @prisma/client, passport, bcrypt, ioredis
# Frontend: next, react, tailwindcss, @tanstack/react-query, lucide-react
```

---

## Quick Reference: File Patterns

| Pattern | File | Purpose |
|---------|------|---------|
| DTO | `wallet/dto/withdraw.dto.ts` | Request validation |
| Guard | `auth/guards/jwt-auth.guard.ts` | Route protection |
| Strategy | `auth/strategies/jwt.strategy.ts` | Passport config |
| Service | `wallet/wallet.service.ts` | Business logic |
| Controller | `wallet/wallet.controller.ts` | HTTP layer |
| Provider | `offers/providers/cpx.provider.ts` | External adapter |
| Module | `wallet/wallet.module.ts` | NestJS module |

---

*Last Updated: 2026-07-02 | Version: 1.0.0*