# Testing Strategy - DZCASH

> **Purpose**: Complete testing strategy for a production-grade GPT platform.

---

## Testing Pyramid

```
         ╱  E2E (5%)  ╲        ← Critical user journeys (Playwright)
        ╱  Integration  ╲       ← Module interactions (Supertest)
       ╱   (25%)        ╲
      ╱  Unit Tests      ╲      ← Pure logic, services (Vitest)
     ╱    (70%)           ╲
    ╱────────────────────────╲
```

---

## Tool Selection

| Layer | Tool | Reason |
|-------|------|--------|
| Unit Tests | **Vitest** | Faster than Jest, native TS/ESM, compatible config |
| Integration | **Supertest** | HTTP assertions for NestJS controllers |
| E2E | **Playwright** | Multi-browser, reliable, network mocking |
| Coverage | **c8/istanbul** | Built into Vitest |
| Test DB | **Testcontainers** | PostgreSQL in Docker for integration tests |

### Installation
```bash
# Backend
cd backend
npm install -D vitest @vitest/coverage-v8 supertest @types/supertest
npm install -D testcontainers

# Frontend (E2E)
cd frontend
npm install -D @playwright/test
```

---

## Backend Testing Strategy

### Vitest Configuration
```typescript
// backend/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: 'src',
    include: ['**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.service.ts', 'src/**/*.provider.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    setupFiles: ['../test/setup.ts'],
  },
});
```

### Test Setup
```typescript
// backend/test/setup.ts
import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GenericContainer } from 'testcontainers';

let container;
let prisma: PrismaClient;

beforeAll(async () => {
  // Start PostgreSQL for integration tests
  container = await new GenericContainer('postgres:15-alpine')
    .withEnvironment({
      POSTGRES_USER: 'test',
      POSTGRES_PASSWORD: 'test',
      POSTGRES_DB: 'test',
    })
    .withExposedPorts(5432)
    .start();

  process.env.DATABASE_URL = `postgresql://test:test@localhost:${container.getMappedPort(5432)}/test`;
  
  prisma = new PrismaClient();
  await prisma.$connect();
  
  // Run migrations
  const { execSync } = require('child_process');
  execSync('npx prisma migrate deploy', { env: { ...process.env } });
});

afterAll(async () => {
  await prisma.$disconnect();
  await container.stop();
});
```

---

## Unit Test Patterns

### Service Tests (Pure Logic)
```typescript
// backend/src/wallet/wallet.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock Prisma
const mockPrisma = {
  $transaction: vi.fn(),
  wallet: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  transaction: {
    create: vi.fn(),
    update: vi.fn(),
  },
  withdrawal: {
    create: vi.fn(),
    update: vi.fn(),
  },
};

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    vi.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return wallet balance', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        pendingBalance: { toNumber: () => 5.00 },
        availableBalance: { toNumber: () => 2.50 },
      });

      const result = await service.getBalance('user-1');
      expect(result).toEqual({
        pendingBalance: 5.00,
        availableBalance: 2.50,
      });
    });

    it('should throw NotFoundException for missing wallet', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      await expect(service.getBalance('nonexistent')).rejects.toThrow('Wallet not found');
    });
  });
});
```

### Provider Tests (Signature Validation)
```typescript
// backend/src/offers/providers/cpx.provider.spec.ts
import { describe, it, expect } from 'vitest';
import { CpxProvider } from './cpx.provider';
import * as crypto from 'crypto';

describe('CpxProvider', () => {
  const provider = new CpxProvider();

  it('should validate valid HMAC signature', async () => {
    const clickId = 'test-click-id';
    const payout = '1.2000';
    const status = '1';
    
    const signature = crypto
      .createHmac('sha256', 'cpx_secret_key_123456')
      .update(`${clickId}:${payout}:${status}`)
      .digest('hex');

    const result = await provider.validatePostback(
      { click_id: clickId, payout, status, signature },
      {},
      {},
    );

    expect(result).toBe(true);
  });

  it('should reject invalid HMAC signature', async () => {
    const result = await provider.validatePostback(
      { click_id: 'a', payout: '1.0', status: '1', signature: 'invalid' },
      {},
      {},
    );

    expect(result).toBe(false);
  });

  it('should reject missing parameters', async () => {
    const result = await provider.validatePostback(
      { click_id: 'a', payout: '1.0' }, // missing signature
      {},
      {},
    );

    expect(result).toBe(false);
  });
});
```

### Fraud Service Tests
```typescript
// backend/src/fraud/fraud.service.spec.ts
describe('FraudService', () => {
  describe('calculateAndApplyRisk', () => {
    it('should calculate zero risk for normal activity', () => {});
    it('should add 45 for VPN IP', () => {});
    it('should cap at 100', () => {});
    it('should set FROZEN at score >= 70', () => {});
    it('should set SUSPENDED at score >= 85', () => {});
    it('should create FraudLog for each trigger', () => {});
  });
  
  describe('checkVpn', () => {
    it('should flag mock VPN IPs', () => {});
    it('should not flag normal IPs', () => {});
  });
});
```

---

## E2E Test Patterns (Playwright)

### Configuration
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
```

### Critical User Journey: Complete Flow
```typescript
// e2e/complete-flow.spec.ts
import { test, expect } from '@playwright/test';

test('Complete user journey: register -> click offer -> withdraw', async ({ page }) => {
  // 1. Navigate to home page
  await page.goto('/');
  await expect(page.locator('text=Start Earning Now')).toBeVisible();

  // 2. Register new user
  await page.click('text=Register');
  const email = `test-${Date.now()}@example.com`;
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', 'test123456');
  await page.fill('[name="confirmPassword"]', 'test123456');
  await page.click('text=Create Account');
  
  // 3. Should redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('text=Available Balance')).toBeVisible();

  // 4. Navigate to offers
  await page.click('text=Offers');
  await expect(page.locator('text=Available Offer Walls')).toBeVisible();

  // 5. Click an offer
  await page.click('text=Start Offer');
  // New tab should open (we can't test this in Playwright easily)
  // Instead, check that loading state appears

  // 6. Navigate to wallet
  await page.click('text=Wallet');
  await expect(page.locator('text=Withdrawal')).toBeVisible();

  // 7. Request withdrawal
  // (requires available balance from admin settlement)
});
```

### Auth Flow Test
```typescript
// e2e/auth.spec.ts
test.describe('Authentication', () => {
  test('should register new user', async ({ page }) => {
    // Fill registration form
    // Verify success and redirect
  });

  test('should login existing user', async ({ page }) => {
    // Fill login form
    // Verify token in localStorage
    // Verify redirect to dashboard
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Try wrong password
    // Verify error message
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access /dashboard without auth
    // Verify redirect to /login
  });
});
```

---

## Test Data Fixtures

```typescript
// test/fixtures/users.ts
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  passwordHash: '$2b$10$...', // "password123"
  referralCode: 'TEST123',
  status: 'ACTIVE',
  riskScore: 0,
  ...overrides,
});

export const createTestWallet = (overrides = {}) => ({
  id: 'test-wallet-id',
  userId: 'test-user-id',
  pendingBalance: 5.00,
  availableBalance: 2.50,
  ...overrides,
});
```

---

## Coverage Targets

| Module | Lines | Functions | Branches | Priority |
|--------|-------|-----------|----------|----------|
| AuthService | 90% | 90% | 85% | Critical |
| WalletService | 95% | 95% | 90% | Critical |
| FraudService | 90% | 90% | 85% | Critical |
| TrackingService | 85% | 85% | 80% | Critical |
| CpxProvider | 100% | 100% | 100% | High |
| OfferToroProvider | 100% | 100% | 100% | High |
| GenericProvider | 100% | 100% | 100% | High |
| OffersService | 80% | 80% | 75% | Medium |
| UsersService | 80% | 80% | 75% | Medium |

---

## CI Integration

```yaml
# .github/workflows/ci.yml (PLANNED)
name: Test and Lint
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install backend dependencies
        run: cd backend && npm ci
      
      - name: Run migrations
        run: cd backend && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
      
      - name: Run backend tests
        run: cd backend && npm run test:cov
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          VPN_API_MOCK: "true"
      
      - name: Install frontend dependencies
        run: cd frontend && npm ci
      
      - name: Run frontend lint
        run: cd frontend && npm run lint
```

---

*Last Updated: 2026-07-02 | Version: 1.0.0*