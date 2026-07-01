# At-least-once delivery — outbox relay + `IdempotencyGuard`

How consumer-side dedup works today, open design questions, and code-review findings.

## Problem

The outbox relay delivers **at-least-once**: it publishes events, then marks outbox rows processed. If `publish` succeeds but `markProcessed` fails (or the process crashes between the two), the same message is relayed again.

Email and other side effects must be **at-most-once**. `IdempotencyGuard` is the consumer-side check: “have I already acted on this outbox message?”

## Flow

```
OutboxRelay
  → publish(envelope with id = outbox row id)
  → EmailSubscriber / other handlers
    → IdempotencyGuard.claim(id)
    → side effect (SMTP, projection write, …)
    → claim.release() only on failure
```

Relay code (`src/platform/outbox/outbox-relay.ts`):

1. `fetchPending` → `toDomainEventEnvelope` (sets `id` from outbox row)
2. `eventBus.publish(envelopes)`
3. `markProcessed(ids)`

## `IdempotencyGuard` API

```ts
claim(id?: string): Promise<ClaimHandle | null>
// ClaimHandle.release() — undo claim so retry can win
```

`DrizzleIdempotencyGuard` (`src/platform/idempotency-guard/drizzle-idempotency-guard.ts`):

| `claim(id)` result      | Meaning                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| **Handle returned**     | First time seeing this id — proceed                                     |
| **`null`**              | Row already in `processed_deliveries` — duplicate, skip                 |
| **No id** (`undefined`) | Noop handle — always proceed (tests / in-process events without outbox) |

Implementation: `INSERT … ON CONFLICT DO NOTHING RETURNING` — atomic first-wins.

On success the row stays (blocks future redelivery). On delivery failure, `release()` deletes the row so relay retry can claim again.

## Email subscribers

`IdempotentEmailSubscriber` template method (`src/modules/notification/application/subscribers/idempotent-email.subscriber.ts`):

1. `claim(event.id)` → skip if `null`
2. `deliver(event)` (subclass: send email)
3. On error → `claim.release()` → rethrow

`SubscriptionConfirmedSubscriber` overrides `handle()` to upsert the recipient projection, then calls `deliverIdempotently()`.

---

## Design Q&A

### 1. Why is `event.id` optional? Can it be required?

**Why optional today**

`DomainEventEnvelope` is used in two phases:

| Phase       | Who builds it                       | Has `id`?                       |
| ----------- | ----------------------------------- | ------------------------------- |
| **Produce** | use cases, `ScanUseCase`            | No — outbox assigns on insert   |
| **Consume** | `toDomainEventEnvelope` after relay | Yes — from `outbox_messages.id` |

`DrizzleOutboxRepository.save` generates ids; producers never set them on the envelope.

**Making it required**

- **Split types (recommended):** `IntegrationEvent` (writers, no `id`) vs `RelayedEvent` (`id: string` required, subscribers + guard).
- **Require on envelope:** forces fake ids at every producer or duplicates id generation outside outbox.
- **Keep optional, fail closed in guard:** `claim(undefined)` throws in production instead of noop.

### 2. Should recipient projection + idempotent delivery run in one transaction?

**Short answer:** one DB transaction for **claim + recipient upsert** is optional hardening; **never** put SMTP in that transaction.

Today `SubscriptionConfirmedSubscriber` saves the recipient **before** `deliverIdempotently()`:

- Duplicate relay: upsert runs again (harmless), email correctly skipped.
- Awkward: save runs even when duplicate skips email; ordering makes stuck-state worse (see review #2 below).

**Reasonable target shape**

```
claim(id) → null? return
try:
  TX { upsert recipient }   // optional: claim insert in same TX
  send email                // outside TX
catch:
  release claim
```

Move `recipientRepository.save` **inside** the guarded path (after claim, before email) so duplicates skip both.

### 3. Scanner projection subscribers — guards / existence checks?

| Handler                               | Idempotent today? | Notes                                                                                             |
| ------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| **Scanner `SubscriptionDeactivated`** | Yes (de facto)    | No-op if repo/watcher missing                                                                     |
| **Scanner `SubscriptionConfirmed`**   | **No**            | Re-fetches GitHub on every delivery; `addWatcher` overwrites `lastNotifiedTag` with _current_ tag |
| **Notification email subscribers**    | Yes               | `IdempotencyGuard` on outbox `id`                                                                 |

**Scanner confirmed on redelivery:** if a newer release shipped since confirm, replay can overwrite `lastNotifiedTag` and cause missed or wrong release notifications.

**Recommendations**

1. Wrap scanner confirmed (and any side-effecting handler) with `IdempotencyGuard`, same as email.
2. Prefer `lastNotifiedTag` on `SubscriptionConfirmed` event payload (set at confirm in use case) instead of calling GitHub in the subscriber — replay stays deterministic.
3. `if (watcher exists) return` alone is incomplete on partial failure; guard on outbox `id` is the uniform fix.

**Deactivated** can stay as-is (delete/remove are naturally idempotent).

---

## Code review findings

Ordered by severity. Status: open unless fixed in a later commit.

### Critical

#### 1. Scanner `SubscriptionConfirmed` not idempotent on outbox redelivery

`src/modules/scanner/application/subscribers/subscription-confirmed.subscriber.ts` calls GitHub on every handle and upserts the watcher with the **current** latest tag. Email subscribers dedupe; scanner does not.

**Risk:** redelivery after a newer release → wrong `lastNotifiedTag` → missed notifications.

**Missing test:** redelivery with a different GitHub tag does not change an existing watcher cursor.

**Fix:** `IdempotencyGuard`, skip-if-watcher-exists, and/or `lastNotifiedTag` from event payload.

#### 2. Claim-before-success can permanently drop welcome email

Claim is inserted before SMTP. Crash after claim, before `deliver` (no `release`) → row stays → redelivery gets `null` → email skipped forever.

`SubscriptionConfirmedSubscriber` saves recipient **before** the guard, so redelivery can leave recipient row without welcome email.

**Missing test:** claim succeeds → crash before deliver → redelivery does not send email.

**Fix:** claim after successful side effect, lease/TTL, or success-based claim; move recipient save inside guarded path.

### High

#### 3. Optional `event.id` + fail-open guard

`claim(undefined)` returns noop handle — dedup disabled. Safe while only relay publishes (always sets `id`). Fail-open if anything publishes to the bus without id.

#### 4. Recipient save outside idempotent path

On duplicate delivery, `save` always runs; email skipped. Harmless upsert but masks stuck welcome-email scenario.

**Missing test:** duplicate claim → `save` not called on second handle.

### Medium

#### 5. `ScanUseCase` advances cursors when writing to outbox

Cursors update in the same TX as `outbox.save`, before relay delivers. Valid outbox pattern: scan won’t re-emit; relay retries the row; email dedup handles relay retries.

**Residual risk:** permanent delivery failure (e.g. `RecipientNotFoundError`) with cursors already advanced.

**Missing test:** relay retry after cursor advance still delivers email once.

#### 6. Outbox relay batch is all-or-nothing on `markProcessed`

Partial batch failure → some emails sent, none marked processed → full batch retries. Email dedup OK; scanner handlers without guards re-run (see #1).

#### 7. Other handlers without dedup

Notification `SubscriptionDeactivated` (delete) and scanner deactivated (no-op) are low risk.

### Low / operational

- `processed_deliveries` grows without retention/TTL.
- `release()` failure can leave a stuck claim (rare).
- Recipient projection only on confirm (not subscribe-path events) — OK while scan only watches confirmed users.

---

## What’s in good shape

- Claim + `ON CONFLICT DO NOTHING` is correct atomic dedup.
- `IdempotentEmailSubscriber` template method; `release` on SMTP failure.
- `NewReleaseDetectedSubscriber` duplicate-delivery unit test.
- `OutboxRelay` tests: happy path, empty batch, publish failure.
- Handler order: notification before scanner on `SubscriptionConfirmed`.
- `fetchPending` with `FOR UPDATE SKIP LOCKED` for concurrent relay workers.

---

## Test gaps (priority)

| Scenario                                     | Covered?      |
| -------------------------------------------- | ------------- |
| `DrizzleIdempotencyGuard` claim/release      | Yes           |
| Email skip on duplicate claim                | Yes (partial) |
| End-to-end relay → redelivery → single email | No            |
| Scanner confirmed redelivery / tag overwrite | No            |
| Confirmed: crash after claim, before email   | No            |
| Confirmed: duplicate skips email and save    | No            |
| Outbox partial batch failure                 | No            |

---

## Suggested fix order

1. Scanner confirmed — guard and/or event-payload `lastNotifiedTag`; stop re-fetching GitHub on replay.
2. Confirmed subscriber — recipient save inside guarded path; revisit claim timing.
3. Types — require `id` on relayed envelopes (`RelayedEvent`).
4. Integration test — relay once, force redelivery, assert one email + stable projection cursors.
