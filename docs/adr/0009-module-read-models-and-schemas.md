# ADR-0009: Module read models and per-module schemas

**Status:** Accepted  
**Date:** 2026-07-01  
**Source:** [PR #12 — HW8 Message broker](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/12)

## Context

Release tracking (`last_seen_tag`) and email delivery data lived on or beside the `subscriptions` table. Scanner and notification modules reached across context boundaries through shared tables and synchronous ports (`SubscriptionQueries`). Each bounded context needs its own persistence for data it owns locally.

## Decision

### Scanner: `MonitoredRepo` projection

Scanner no longer reads or writes the `subscriptions` table. It owns a **`MonitoredRepo`** aggregate — one row per repo with embedded **`RepoWatcher`** entries per confirmed subscription.

- `last_seen_tag` removed from `subscriptions`; moved to `monitored_repos`
- **`ReleaseTag`** moved from subscription domain to scanner domain
- Scan loop iterates **repos**, not subscriptions — one GitHub API call per repo regardless of watcher count

Scanner subscribers react to subscription lifecycle events:

- **`SubscriptionConfirmed`** — fetch latest release from GitHub, add watcher with `lastNotifiedTag` set to the current tag (or `null` if the repo has no releases); baseline tag initialization is scanner responsibility
- **`SubscriptionDeactivated`** — remove watcher; delete `MonitoredRepo` when the last watcher is gone

`ScanUseCase` reads `MonitoredRepo` rows, compares `lastSeenTag` to GitHub, updates tags locally, and publishes `NewReleaseDetected` for watchers that need notification.

### Notification: `Recipient` projection

Notification module owns a **`notification_recipients`** table and **`Recipient`** aggregate — a local read model keyed by `subscriptionId` with email and unsubscribe token.

- Created on `SubscriptionConfirmed`
- Deleted on `SubscriptionDeactivated`
- `NewReleaseDetectedSubscriber` looks up the recipient by `aggregateId` to send the release email without touching subscription data

### Per-module Postgres schema and migrations

Each module owns its Drizzle schema and migration folder:

- `drizzle.platform.config.ts` → `platform` schema
- `drizzle.subscription.config.ts` → `subscription` schema
- `drizzle.scanner.config.ts` → `scanner` schema (`monitored_repos`)
- `drizzle.notification.config.ts` → `notification` schema (`notification_recipients`)

Root `drizzle.config.ts` aggregates schemas via `schemaFilter` for tooling. Migrations live under each module's `infrastructure/db/migrations/`.

## Consequences

**Positive**

- Each context owns tables that match its language; no cross-module repository access.
- Repo-centric scanning reduces duplicate GitHub API calls when many subscribers watch the same repo.
- Per-module migrations let schema changes stay scoped to the owning bounded context.

**Negative / trade-offs**

- Projections can lag or diverge if an event subscriber fails — consistency depends on synchronous in-process delivery (ADR-0008).
- `subscriptionId` is duplicated as a foreign key in scanner and notification tables without database-enforced cross-schema FKs.
- More tables and migration configs to maintain; startup must run migrations for all module schemas.
