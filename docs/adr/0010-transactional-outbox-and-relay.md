# ADR-0010: Transactional outbox and relay

**Status:** Accepted  
**Date:** 2026-07-05  
**Source:** [PR #9 — HW9 Outbox](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/9)

## Context

With the in-process event bus (ADR-0008), publishers called `EventBus.publish()` directly inside use cases. Domain state and event dispatch were not atomic — a crash after commit but before publish left subscribers unaware of a state change. Conversely, a slow or failing subscriber blocked the publisher synchronously. There was no retry or poison-message handling.

## Decision

Replace direct bus publishes with a **transactional outbox** under `platform/outbox/`:

| Piece                         | Role                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **`Outbox`**                  | `save(events, tx)` — write integration events inside the use-case transaction                                           |
| **`DrizzleOutboxRepository`** | Persists to `platform.outbox_messages`; `fetchPending` uses `FOR UPDATE SKIP LOCKED` and excludes dead-lettered rows    |
| **`OutboxRelay`**             | Fetches pending messages, publishes to `EventBus`, marks processed; records failures and dead-letters after max retries |
| **`OutboxRelayCron`**         | Polls relay on a cron schedule (default every 3s via `OUTBOX_RELAY_CRON`)                                               |

### Publishers write to outbox only

Use cases persist domain state and outbox rows in the **same database transaction**, then return. Relay is asynchronous.

| Module           | Use cases                                                  |
| ---------------- | ---------------------------------------------------------- |
| **subscription** | `SubscribeUseCase`, `ConfirmUseCase`, `UnsubscribeUseCase` |
| **scanner**      | `ScanUseCase` (`NewReleaseDetected` events)                |

### `Delivered<T>` envelope

After relay, events gain an outbox message `id`. Subscribers receive `Delivered<IntegrationEvent>` so consumers can distinguish individual deliveries (see ADR-0011).

### In-table dead-lettering

Extended `platform.outbox_messages`:

| Column             | Purpose                                                       |
| ------------------ | ------------------------------------------------------------- |
| `attempt_count`    | Incremented on each relay failure                             |
| `last_error`       | Truncated error from last failure                             |
| `dead_lettered_at` | Set when max retries exceeded; row kept for inspection/replay |

**Pending** = `processed_at IS NULL AND dead_lettered_at IS NULL`. Dead-lettered rows are never fetched again. Manual replay clears dead-letter state on the row.

Config: `OUTBOX_MAX_RETRIES` (default 10).

### Platform schema

New tables in the `platform` Postgres schema (`drizzle.platform.config.ts`):

- `outbox_messages` — pending integration events + dead-letter state
- `processed_deliveries` — subscriber idempotency keys (ADR-0011)

### Outbox observability

Prometheus metrics: `outbox_relay_failures_total`, `outbox_dead_letters_total`, `outbox_pending_messages`, `outbox_dead_letter_messages`, `outbox_oldest_pending_age_seconds`.

Grafana: outbox panels on the monitoring dashboard; provisioned alerts for dead-letter detected and stuck pending (>15 min).

## Consequences

**Positive**

- Domain writes and event publication are atomic — no lost events on crash after commit.
- Publishers no longer block on subscriber work; relay retries failures independently.
- Dead-lettered rows and metrics give operators visibility into poison messages.

**Negative / trade-offs**

- Event delivery is **at-least-once** — subscribers must be idempotent (ADR-0011).
- Subscribers see events only after relay latency (cron interval + processing time).
- Dead-letter replay is manual SQL today; misconfiguration can leave messages stuck until alerted.
- Outbox adds write amplification and a background poller to operate.
