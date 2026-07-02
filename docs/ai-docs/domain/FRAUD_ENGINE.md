# Fraud Detection Engine - DZCASH

> **Purpose**: Complete specifications for fraud detection, risk scoring, and automatic penalty enforcement.

---

## Risk Scoring Overview

```
                      Risk Score (0-100)
                              |
            ┌─────────────────┼─────────────────┐
            v                 v                  v
         0-69              70-84             85-100
        ACTIVE             FROZEN           SUSPENDED
    (no restrictions)   (no withdrawals)   (full lockout)
```

---

## Scoring Triggers

### Trigger 1: VPN/Proxy Detection (+45)

**Checkpoint:** Click creation AND Postback processing

```typescript
// backend/src/fraud/fraud.service.ts
private checkVpn(ip: string): boolean {
  if (process.env.VPN_API_MOCK === 'true') {
    // Mock mode for development/testing
    const mockVpnIps = ['127.0.0.9', '8.8.8.8'];
    if (mockVpnIps.includes(ip) || ip.includes('vpn') || ip.includes('proxy')) {
      return true;
    }
    return false;
  }
  
  // PRODUCTION: Integrate with IP reputation API
  // Example: IPQualityScore, ipapi.is, ip2location
  // Cache results in Redis with 1hr TTL
  // return await this.ipQualityCheck(ip);
  
  return false;
}
```

**Production Integration Plan:**
```typescript
// PLANNED: External API integration
async checkVpnProduction(ip: string): Promise<boolean> {
  const cacheKey = `ip_reputation:${ip}`;
  
  // Check Redis cache first
  const cached = await this.redis.get(cacheKey);
  if (cached) return cached === 'true';
  
  // Call IP reputation API
  const response = await axios.get(`https://ipqualityscore.com/api/json/${API_KEY}/${ip}`);
  const isVpn = response.data.proxy || response.data.vpn;
  
  // Cache for 1 hour
  await this.redis.set(cacheKey, isVpn ? 'true' : 'false', 'EX', 3600);
  
  return isVpn;
}
```

### Trigger 2: Device Fingerprint Clone (+25 per clone, max +50)

**Checkpoint:** Click creation

```typescript
// backend/src/fraud/fraud.service.ts
// Checked inside calculateAndApplyRisk()
if (deviceFingerprint) {
  const clonesCount = await this.prisma.user.count({
    where: {
      id: { not: userId },
      clicks: {
        some: { deviceFingerprint },
      },
    },
  });

  if (clonesCount > 1) {
    const penalty = Math.min(clonesCount * 25, 50);
    score += penalty;
    // Log: { triggerType: DEVICE_FINGERPRINT_CLONE, score: penalty, details: { deviceFingerprint, duplicateAccountsCount: clonesCount } }
  }
}
```

**How It Works:**
- Device fingerprint sent via `x-device-fingerprint` header
- Stored in `Click.deviceFingerprint`
- Counts distinct User accounts sharing same fingerprint
- Penalty applies only if more than 1 user (1 account per device is normal)

### Trigger 3: High Click Velocity (+30)

**Checkpoint:** Click creation

```typescript
// backend/src/fraud/fraud.service.ts
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
const recentClicksCount = await this.prisma.click.count({
  where: {
    userId,
    createdAt: { gte: fiveMinutesAgo },
  },
});

if (recentClicksCount > 15) {
  score += 30;
  // Log: { triggerType: HIGH_VELOCITY, score: 30, details: { clicksInLast5Min: recentClicksCount } }
}
```

**Threshold:**
- >15 clicks in 5 minutes = suspicious activity
- Normal user: 2-5 clicks in 5 minutes
- Bot: 15+ clicks in 5 minutes

### Trigger 4: Geo Inconsistency (+40)

**Checkpoint:** Postback processing (comparing click IP with postback IP)

```typescript
// backend/src/fraud/fraud.service.ts
async checkGeoInconsistency(userId: string, clickId: string, postbackIp: string): Promise<boolean> {
  const click = await this.prisma.click.findUnique({ where: { id: clickId } });
  if (!click) return false;

  // Simple subnet comparison (first octet)
  const isDifferentSubnet = click.ip.split('.')[0] !== postbackIp.split('.')[0];
  
  // Skip localhost IPs
  if (isDifferentSubnet && !isLocalhost(click.ip) && !isLocalhost(postbackIp)) {
    // Apply penalty
    const penalty = 40;
    await this.prisma.fraudLog.create({
      data: {
        userId,
        clickId,
        triggerType: FraudTriggerType.GEO_INCONSISTENCY,
        score: penalty,
        details: { clickIp: click.ip, postbackIp },
      },
    });

    await this.updateUserRiskScore(userId, penalty);
    return true;
  }

  return false;
}
```

**Logic:**
- Compare first subnet of click IP vs postback IP
- If different: potential geo-spoofing (user clicks from one country, claims conversion from another)
- Skip localhost/private IPs (development)

---

## Risk Score Calculation

```typescript
// Complete scoring function
async calculateAndApplyRisk(
  userId: string,
  ip: string,
  deviceFingerprint?: string,
): Promise<number> {
  let score = 0;
  const triggers: Trigger[] = [];

  // 1. VPN Check (+45)
  if (this.checkVpn(ip)) {
    score += 45;
    triggers.push({ type: FraudTriggerType.VPN_DETECTED, score: 45, details: { ip } });
  }

  // 2. Device Fingerprint Clone (+25 each, max +50)
  if (deviceFingerprint) {
    const clonesCount = await this.countFingerprintClones(userId, deviceFingerprint);
    if (clonesCount > 1) {
      const penalty = Math.min(clonesCount * 25, 50);
      score += penalty;
      triggers.push({
        type: FraudTriggerType.DEVICE_FINGERPRINT_CLONE,
        score: penalty,
        details: { deviceFingerprint, duplicateAccountsCount: clonesCount },
      });
    }
  }

  // 3. Click Velocity (+30)
  const recentClicks = await this.countRecentClicks(userId);
  if (recentClicks > 15) {
    score += 30;
    triggers.push({
      type: FraudTriggerType.HIGH_VELOCITY,
      score: 30,
      details: { clicksInLast5Min: recentClicks },
    });
  }

  // Log all triggers
  for (const trigger of triggers) {
    await this.prisma.fraudLog.create({
      data: { userId, triggerType: trigger.type, score: trigger.score, details: trigger.details },
    });
  }

  // Cap at 100
  const finalScore = Math.min(score, 100);

  // Determine status
  let statusUpdate = UserStatus.ACTIVE;
  if (finalScore >= 85) {
    statusUpdate = UserStatus.SUSPENDED;
  } else if (finalScore >= 70) {
    statusUpdate = UserStatus.FROZEN;
  }

  // Update user
  await this.prisma.user.update({
    where: { id: userId },
    data: { riskScore: finalScore, status: statusUpdate },
  });

  return finalScore;
}
```

---

## Penalty Enforcement

### Status Matrix

| Status | Can Login? | Can Click Offers? | Can Withdraw? | Can See Balance? |
|--------|------------|-------------------|---------------|------------------|
| ACTIVE | Yes | Yes | Yes | Yes |
| FROZEN | Yes | Yes | **No** | Yes (read-only) |
| SUSPENDED | **No** | **No** | **No** | **No** |

### Implementation
```typescript
// SUSPENDED: Block login
// backend/src/auth/auth.service.ts
if (user.status === 'SUSPENDED') {
  throw new UnauthorizedException('This account has been suspended');
}

// SUSPENDED/FROZEN: Block click
// backend/src/tracking/tracking.service.ts
if (user.status === 'SUSPENDED' || user.status === 'FROZEN') {
  throw new BadRequestException('Action blocked due to high security risk score');
}

// FROZEN/SUSPENDED: Block withdrawal
// backend/src/wallet/wallet.service.ts
if (user.status === 'FROZEN' || user.status === 'SUSPENDED') {
  throw new BadRequestException('Account restricted from making withdrawals');
}
```

---

## Manual Override (Admin)

### Admin can:
1. Review fraud logs in admin panel
2. Set user status manually (ACTIVE, FROZEN, SUSPENDED)
3. Override risk score (set to 0 after review)
4. Add notes to fraud logs

```typescript
// PLANNED: Admin review function
async reviewFraudLog(
  fraudLogId: string,
  action: 'dismiss' | 'sustain',
  notes: string,
): Promise<FraudLog> {
  // Dismiss: Remove score from user's total
  // Sustain: Keep penalty, add admin notes
}
```

---

## Fraud Log Audit

```typescript
// Sample FraudLog entries for analysis
interface FraudLogEntry {
  id: string;
  userId: string;
  clickId?: string;
  triggerType: FraudTriggerType;
  score: number;
  details: Record<string, any>;
  createdAt: Date;
}

// Example: VPN detected
{
  id: "uuid",
  userId: "uuid",
  clickId: null,
  triggerType: "VPN_DETECTED",
  score: 45,
  details: { ip: "127.0.0.9", detectionMethod: "mock" },
  createdAt: "2026-07-02T10:00:00Z"
}

// Example: Device clone
{
  id: "uuid",
  userId: "uuid",
  clickId: null,
  triggerType: "DEVICE_FINGERPRINT_CLONE",
  score: 50,
  details: { deviceFingerprint: "abc123def456", duplicateAccountsCount: 3 },
  createdAt: "2026-07-02T10:00:00Z"
}
```

---

## Testing Scenarios

### Unit Tests Needed
```typescript
// 1. VPN Detection
it('should add 45 points for VPN IP', () => { /* ... */ });
it('should not flag normal IPs', () => { /* ... */ });

// 2. Device Clone
it('should add 25 per clone over 1', () => { /* ... */ });
it('should cap at 50 for many clones', () => { /* ... */ });
it('should ignore null fingerprints', () => { /* ... */ });

// 3. Velocity
it('should flag >15 clicks in 5 minutes', () => { /* ... */ });
it('should not flag normal click rate', () => { /* ... */ });

// 4. Geo Inconsistency
it('should flag different IP subnets', () => { /* ... */ });
it('should skip localhost IPs', () => { /* ... */ });

// 5. Status Enforcement
it('should set FROZEN at score >= 70', () => { /* ... */ });
it('should set SUSPENDED at score >= 85', () => { /* ... */ });
it('should keep ACTIVE for score < 70', () => { /* ... */ });

// 6. Fraud Log
it('should create FraudLog for each trigger', () => { /* ... */ });
it('should include correct details JSON', () => { /* ... */ });
```

---

## Future Enhancements (PLANNED)

### Phase 2: IP Reputation API
- Integrate IPQualityScore or ipapi.is
- Cache results in Redis (1hr TTL)
- Real-time VPN/proxy/Datacenter detection

### Phase 3: Machine Learning
- Anomaly detection on click patterns
- Behavioral biometrics (mouse movement, typing speed)
- Graph analysis for referral rings

### Phase 3: Enhanced Checks
- Email domain reputation
- Phone number verification
- Social media verification
- Browser fingerprinting (Canvas, WebGL, AudioContext)

---

*Last Updated: 2026-07-02 | Version: 1.0.0*