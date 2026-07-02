import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private redis?: RedisService,
  ) {}

  async check(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    uptime: number;
    timestamp: string;
    checks: {
      database: { status: string; latency: number };
      redis?: { status: string; latency: number };
    };
  }> {
    const checks: any = { database: { status: 'unknown', latency: 0 } };

    // Check database
    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy', latency: Date.now() - dbStart };
    } catch (err) {
      checks.database = { status: 'unhealthy', latency: 0, error: (err as Error).message };
    }

    // Check Redis
    if (this.redis) {
      try {
        const redisStart = Date.now();
        await this.redis.ping();
        checks.redis = { status: 'healthy', latency: Date.now() - redisStart };
      } catch (err) {
        checks.redis = { status: 'unhealthy', latency: 0, error: (err as Error).message };
      }
    }

    const status =
      checks.database.status === 'healthy' && (!checks.redis || checks.redis.status === 'healthy')
        ? 'healthy'
        : checks.database.status === 'healthy' || checks.redis?.status === 'healthy'
        ? 'degraded'
        : 'unhealthy';

    return {
      status,
      version: this.config.get('APP_VERSION', '1.0.0'),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
