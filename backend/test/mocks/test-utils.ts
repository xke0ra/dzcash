import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { join } from 'path';
import { randomUUID } from 'crypto';

const testDatabaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://dzcash:dzcash@localhost:5433/dzcash_test';

export class TestPrismaService extends PrismaClient {
  constructor() {
    super({
      datasources: { db: { url: testDatabaseUrl } },
    });
  }

  async cleanDatabase() {
    const tablenames = await this.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await this.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      }
    }
  }

  async createTestUser(overrides: Partial<any> = {}) {
    const referralCode = randomUUID().substring(0, 8).toUpperCase();
    return this.user.create({
      data: {
        email: overrides.email || `test-${randomUUID().substring(0, 8)}@test.com`,
        passwordHash: '$2b$10$test_hash',
        referralCode: overrides.referralCode || referralCode,
        status: overrides.status || 'ACTIVE',
        role: overrides.role || 'USER',
        riskScore: overrides.riskScore || 0,
        ...overrides,
      },
    });
  }

  async createTestWallet(userId: string, overrides: Partial<any> = {}) {
    return this.wallet.create({
      data: {
        userId,
        pendingBalance: overrides.pendingBalance || 0,
        availableBalance: overrides.availableBalance || 0,
      },
    });
  }

  async createTestOffer(overrides: Partial<any> = {}) {
    return this.offer.create({
      data: {
        provider: overrides.provider || 'CPX',
        providerId: overrides.providerId || `test-${randomUUID().substring(0, 8)}`,
        name: overrides.name || 'Test Offer',
        description: overrides.description || 'Test description',
        payoutAmount: overrides.payoutAmount || 1.0,
        rewardAmount: overrides.rewardAmount || 0.5,
        status: overrides.status !== undefined ? overrides.status : true,
        targetUrl: overrides.targetUrl || 'https://example.com/offer?click_id={click_id}',
      },
    });
  }
}

export function getTestJwtToken(userId: string, email: string, role = 'USER') {
  // Use the same secret as in production
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { sub: userId, email, role },
    process.env.JWT_SECRET || 'super-secret-jwt-key-change-this-in-production',
    { expiresIn: '1h' },
  );
}
