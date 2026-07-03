# Database Index Strategy

## User
| Index | Columns | Purpose |
|-------|---------|---------|
| Primary | `id` | Unique identifier |
| Simple | `status` | Filter active/suspended/frozen users |
| Simple | `role` | Admin queries |
| Simple | `riskScore` | Fraud scoring order/queries |
| Simple | `createdAt` | Registration date range queries |
| Simple | `ipAddress` | Multi-account detection, login geo checks |
| Unique | `email` | Login, uniqueness |
| Unique | `referralCode` | Referral lookups |

## Session
| Index | Columns | Purpose |
|-------|---------|---------|
| Composite | `(userId, expiresAt)` | Active sessions per user |
| Simple | `expiresAt` | Session cleanup queries |
| Unique | `refreshToken` | Token refresh lookups |

## Wallet
| Index | Columns | Purpose |
|-------|---------|---------|
| Unique | `userId` | One wallet per user |
| Simple | `updatedAt` | Staleness check, admin reporting |

## Click
| Index | Columns | Purpose |
|-------|---------|---------|
| Composite | `(userId, createdAt)` | Click velocity checks, user history |
| Composite | `(offerId, status)` | Provider conversion tracking |
| Simple | `deviceFingerprint` | Device clone detection |
| Simple | `ip` | IP-based fraud queries |

## Transaction
| Index | Columns | Purpose |
|-------|---------|---------|
| Composite | `(userId, type, status)` | Wallet history filtered by type |
| Composite | `(userId, createdAt)` | User transaction timeline |
| Composite | `(type, status, createdAt)` | Admin reporting, aggregation |

## Withdrawal
| Index | Columns | Purpose |
|-------|---------|---------|
| Composite | `(userId, createdAt)` | User withdrawal history |
| Composite | `(status, createdAt)` | Pending/processing queue |
| Unique | `id` | Primary key |

## Offer
| Index | Columns | Purpose |
|-------|---------|---------|
| Composite | `(provider, providerId)` | Unique per provider |
| Simple | `categoryId` | Category filtering |
| Simple | `status` | Active/inactive offers |

## FraudLog
| Index | Columns | Purpose |
|-------|---------|---------|
| Composite | `(userId, createdAt)` | User fraud history |
| Simple | `triggerType` | Rule effectiveness stats |
| Simple | `resolved` | Open/resolved filter |

## Notification
| Index | Columns | Purpose |
|-------|---------|---------|
| Composite | `(userId, read)` | Unread count query |
| Composite | `(userId, createdAt)` | Notification timeline |
| Simple | `type` | Admin notification stats |

## AuditLog
| Index | Columns | Purpose |
|-------|---------|---------|
| Simple | `userId` | User audit trail |
| Composite | `(entityType, entityId)` | Entity-specific audit |
| Simple | `createdAt` | Time-range queries |

## PushSubscription
| Index | Columns | Purpose |
|-------|---------|---------|
| Simple | `userId` | User push subscriptions |

## Gamification
| Model | Index | Purpose |
|-------|-------|---------|
| XpTransaction | `(userId, createdAt)` | XP history timeline |
| XpTransaction | `(userId, source)` | XP by source breakdown |
| UserBadge | `(userId)` | User badge list |
| LeaderboardEntry | `(period, score)` | Leaderboard ranking sorted |
| LeaderboardEntry | `(period, rank)` | Leaderboard rank lookup |
| UserChallenge | `(userId)` | User challenges |
| UserChallenge | `(challengeId)` | Challenge participants |

## Behavior Baseline
| Index | Columns | Purpose |
|-------|---------|---------|
| Unique | `userId` | One baseline per user |

## Notes
- All composite indexes follow **leftmost prefix** rule — queries must match the leftmost columns to use the index.
- Single-column indexes on `createdAt` are deliberately omitted on Click/Transaction models since the composite `(userId, createdAt)` index covers user-scoped queries, and full-table time scans are rare.
- The `ipAddress` index on User is not unique (multiple users may share IP from NAT), but supports the multi-account detection query.
