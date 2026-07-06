# ADR-0011: Subscriber idempotency

**Status:** Accepted  
**Date:** 2026-07-05  
**Source:** [PR #9 — HW9 Outbox](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/9)

## Context

The transactional outbox (ADR-0010) relays messages at-least-once: a relay failure after `EventBus.publish()` succeeds but before `markProcessed` can redeliver the same event. Side-effect subscribers — sending email, writing scanner projections — must tolerate duplicate deliveries without sending duplicate notifications or corrupting read models.

## Decision

Add an idempotency layer under `platform/idempotency-guard/`:

| Piece                      | Role                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **`IdempotencyGuard`**     | `isProcessed(key)` / `markProcessed(key)` backed by `platform.processed_deliveries`                                 |
| **`IdempotentSubscriber`** | Base class extending `EventSubscriber<Delivered<T>>`                                                                |
| **`runIfNotProcessed`**    | Checks `{messageId}:{subscriberName}`; skips work if already processed, otherwise runs handler then marks processed |

Each side-effect subscriber gets a stable **`name`** used in the delivery key so the same outbox message can be processed independently by notification and scanner subscribers.

### Subscribers made idempotent

**Notification** — all email subscribers (`SubscriptionRequested`, `SubscriptionConfirmationRenewed`, `SubscriptionReactivated`, `SubscriptionConfirmed`, `SubscriptionDeactivated`, `NewReleaseDetected`).

**Scanner** — `SubscriptionConfirmedSubscriber` (creates/updates `MonitoredRepo` projection and fetches GitHub baseline tag).

Read-only or naturally idempotent handlers still use the same pattern for consistency.

### Processing order

`OutboxRelay` processes each pending message independently in a batch. A failure on one message does not block marking others processed in the same relay run.

## Consequences

**Positive**

- Duplicate relay delivery does not send duplicate emails or double-add watchers.
- Per-subscriber keys allow one message to fan out to multiple consumers safely.
- Idempotency state is durable in Postgres alongside the outbox.

**Negative / trade-offs**

- `markProcessed` runs after side effects — a crash between effect and mark can still repeat work once; handlers should prefer idempotent writes where possible (e.g. upsert recipient, replace watcher).
- `processed_deliveries` grows without retention policy; long-running deployments may need cleanup.
- Every new side-effect subscriber must extend `IdempotentSubscriber` and pick a unique `name`.
