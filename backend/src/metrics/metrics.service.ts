import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  constructor(private config: ConfigService) {}

  onModuleInit() {
    collectDefaultMetrics({
      prefix: 'dzcash_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });
  }

  httpRequestDuration = new Histogram({
    name: 'dzcash_http_request_duration_ms',
    help: 'HTTP request duration in milliseconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  });

  httpRequestsTotal = new Counter({
    name: 'dzcash_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  activeUsers = new Gauge({
    name: 'dzcash_active_users',
    help: 'Number of currently active users',
  });

  totalUsers = new Gauge({
    name: 'dzcash_total_users',
    help: 'Total registered users',
  });

  totalEarned = new Gauge({
    name: 'dzcash_total_earned_usd',
    help: 'Total earnings in USD',
  });

  totalWithdrawn = new Gauge({
    name: 'dzcash_total_withdrawn_usd',
    help: 'Total withdrawn amount in USD',
  });

  pendingWithdrawals = new Gauge({
    name: 'dzcash_pending_withdrawals',
    help: 'Number of pending withdrawals',
  });

  fraudAlertsTotal = new Counter({
    name: 'dzcash_fraud_alerts_total',
    help: 'Total fraud alerts triggered',
    labelNames: ['trigger_type'],
  });

  notificationSent = new Counter({
    name: 'dzcash_notifications_sent_total',
    help: 'Total notifications sent',
    labelNames: ['type', 'channel'],
  });

  dbQueryDuration = new Histogram({
    name: 'dzcash_db_query_duration_ms',
    help: 'Database query duration in milliseconds',
    labelNames: ['operation'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500],
  });

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }
}
