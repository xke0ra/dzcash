# Monitoring & Observability - DZCASH

> **Purpose**: Complete monitoring strategy for production operations.

---

## Architecture

```
Application (Pino) -> File/Stdout
                          |
                    [Fluent Bit / Vector]
                          |
              ┌───────────┴───────────┐
              |                       |
         [Loki (Logs)]        [Prometheus (Metrics)]
              |                       |
              └───────────┬───────────┘
                          |
                    [Grafana Dashboards]
                          |
                    [Alertmanager]
                          |
                    [Slack / PagerDuty]
```

---

## Logging Strategy (Pino)

### Configuration
```typescript
// backend/src/main.ts
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  
  app.useLogger(app.get(Logger));
  
  // ... rest of bootstrap
}
```

```typescript
// backend/src/app.module.ts (PLANNED - with nestjs-pino)
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
        level: process.env.LOG_LEVEL || 'info',
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            correlationId: req.headers['x-correlation-id'],
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
        redact: ['req.headers.authorization', 'body.password', 'body.email'],
      },
    }),
  ],
})
```

### Log Levels
```typescript
// Usage throughout services
this.logger.debug('Debug info (development only)');
this.logger.info('Important state changes', { module: 'tracking', action: 'postback_received' });
this.logger.warn('Suspicious activity', { userId, trigger: 'VPN_DETECTED' });
this.logger.error('System error', { error: err.message, stack: err.stack });
```

### Structured Log Format
```json
{
  "level": 30,
  "time": 1720000000000,
  "pid": 1,
  "hostname": "backend-container",
  "correlationId": "req-abc-123",
  "module": "wallet",
  "action": "withdrawal_requested",
  "userId": "uuid",
  "amount": 50.00,
  "method": "PAYPAL",
  "duration": 45,
  "success": true
}
```

---

## Metrics (Prometheus)

### Exposed Metrics
```typescript
// PLANNED: Using @willsoto/nestjs-prometheus
@Injectable()
export class MetricsService {
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly postbacksTotal: Counter<string>;
  private readonly walletOperationsTotal: Counter<string>;
  private readonly fraudAlertsTotal: Counter<string>;
  private readonly activeUsers: Gauge<string>;

  constructor() {
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in ms',
      labelNames: ['method', 'path'],
      buckets: [50, 100, 200, 500, 1000, 2000],
    });

    this.postbacksTotal = new Counter({
      name: 'postbacks_total',
      help: 'Total postback requests',
      labelNames: ['provider', 'status'],
    });

    this.walletOperationsTotal = new Counter({
      name: 'wallet_operations_total',
      help: 'Wallet operations',
      labelNames: ['type', 'status'],
    });

    this.fraudAlertsTotal = new Counter({
      name: 'fraud_alerts_total',
      help: 'Fraud alerts',
      labelNames: ['triggerType'],
    });

    this.activeUsers = new Gauge({
      name: 'active_users_total',
      help: 'Currently active users',
    });
  }
}
```

### Key Metrics to Track

| Metric | Type | Labels | Why |
|--------|------|--------|-----|
| `http_requests_total` | Counter | method, path, status | Traffic volumes |
| `http_request_duration_ms` | Histogram | method, path | Latency (p50, p95, p99) |
| `postbacks_total` | Counter | provider, status | Conversion rate |
| `clicks_total` | Counter | status | Click-to-conversion funnel |
| `user_registrations_total` | Counter | - | Growth tracking |
| `withdrawals_total` | Counter | method, status | Withdrawal patterns |
| `fraud_alerts_total` | Counter | triggerType | Fraud trends |
| `wallet_balance` | Gauge | type (pending/available) | Total platform liability |
| `db_connections_active` | Gauge | - | Database pool health |
| `redis_memory_used_bytes` | Gauge | - | Cache efficiency |
| `active_users` | Gauge | - | Concurrent users |

---

## Health Checks

### Endpoints
```typescript
// PLANNED: Using @nestjs/terminus
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }

  @Get('/readiness')
  readiness() {
    // Check if service can accept traffic
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  @Get('/liveness')
  liveness() {
    // Check if service is alive
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

### Response Format
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

---

## Alerting Rules

### Critical Alerts (PagerDuty)
```yaml
# Critical - Immediate response required
- alert: PostbackFailureRate
  expr: rate(postbacks_total{status="error"}[5m]) / rate(postbacks_total[5m]) > 0.05
  for: 2m
  severity: critical
  annotations:
    summary: "Postback failure rate > 5%"

- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
  for: 2m
  severity: critical
  annotations:
    summary: "HTTP 5xx error rate > 1%"

- alert: DBConnectionPoolExhausted
  expr: pg_stat_activity_count > 80
  for: 1m
  severity: critical
  annotations:
    summary: "Database connection pool > 80%"

- alert: ServiceDown
  expr: up{job="backend"} == 0
  for: 30s
  severity: critical
```

### Warning Alerts (Slack)
```yaml
# Warning - Review during business hours
- alert: HighWithdrawalQueue
  expr: withdrawals_pending_total > 100
  for: 1h
  severity: warning
  annotations:
    summary: "Withdrawal queue > 100 pending"

- alert: HighFraudRate
  expr: rate(fraud_alerts_total[1h]) > 10
  for: 5m
  severity: warning
  annotations:
    summary: ">10 fraud alerts in the last hour"

- alert: RedisMemoryHigh
  expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.8
  for: 5m
  severity: warning
  annotations:
    summary: "Redis memory usage > 80%"

- alert: SlowResponseTime
  expr: histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m])) > 1000
  for: 5m
  severity: warning
  annotations:
    summary: "p95 response time > 1s"
```

---

## Grafana Dashboard

### Dashboard Panels (PLANNED)

**Row 1: Business KPIs**
| Panel | Metric | Visualization |
|-------|--------|---------------|
| Active Users | `active_users` | Stat |
| Registrations (24h) | `sum(increase(user_registrations_total[24h]))` | Stat |
| Offers Completed (24h) | `sum(increase(clicks_total{status="CONVERTED"}[24h]))` | Stat |
| Revenue (24h) | `sum(increase(revenue_total[24h]))` | Stat |
| Pending Withdrawals | `withdrawals_pending_total` | Stat |
| Fraud Alerts (24h) | `sum(increase(fraud_alerts_total[24h]))` | Stat |

**Row 2: Performance**
| Panel | Metric | Visualization |
|-------|--------|---------------|
| Request Latency (p50/p95/p99) | `histogram_quantile(...)` | Time series |
| Request Rate | `rate(http_requests_total[5m])` | Time series |
| Error Rate | `rate(http_requests_total{status=~"5.."}[5m])` | Time series |
| Active DB Connections | `pg_stat_activity_count` | Time series |

**Row 3: Business Metrics**
| Panel | Metric | Visualization |
|-------|--------|---------------|
| Postback Success Rate | `rate(postbacks_total{status="success"}[5m])` | Time series |
| Fraud Triggers | `rate(fraud_alerts_total[1h])` | Stacked bar |
| Wallet Balance Total | `sum(wallet_balance)` | Time series |
| Withdrawal Volume | `sum(increase(withdrawals_total[24h]))` | Time series |

**Row 4: System Health**
| Panel | Metric | Visualization |
|-------|--------|---------------|
| Redis Memory | `redis_memory_used_bytes` | Time series |
| Docker Container Status | `up{job=~"backend|frontend|nginx"}` | States |
| Disk Usage | `node_filesystem_avail_bytes` | Time series |
| CPU/Memory per Container | `container_cpu_usage_seconds_total` | Time series |

---

*Last Updated: 2026-07-02 | Version: 1.0.0*