# ADR-0005: Service boundaries and subscription schema

**Status:** Accepted  
**Date:** 2026-06-24  
**Source:** [PR #6 — HW4/HW7 SOLID & Modular monolith prep](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/6)

## Context

Services had tangled dependencies: the scanner reached into the subscription repository, subscription code sent emails directly, and a separate `DbSubscriptionTokenManager` duplicated token logic already belonging to the aggregate. The `subscription_tokens` table and `confirmed` boolean also modelled subscription state awkwardly.

## Decision

### Service boundaries

Reorganize services into `src/services/subscription/`, `src/services/scanner/`, and `src/services/notification/` with clearer dependency direction:

```text
Routes → SubscriptionService
Scanner cron → ScannerService → SubscriptionService, NotificationService, GithubClient

SubscriptionService → NotificationService, GithubClient, SubscriptionRepository,
                       TransactionManager, Clock, IdGenerator, TokenGenerator
NotificationService → EmailClient
```

Key rules:

- **Remove `DbSubscriptionTokenManager`** — token lifecycle lives on the `Subscription` aggregate.
- **`ScannerService`** does not use `SubscriptionRepository` directly; it calls **`SubscriptionService`**.
- **`SubscriptionService`** does not send email; all notifications go through **`NotificationService`**.
- **`NotificationService`** renamed email dependency to **`EmailClient`**; email templates move into the notification service.

### Persistence model

**Inline tokens** — drop `subscription_tokens` table; store token columns on `subscriptions`:

- `confirm_token`, `confirm_expires_at`, `confirm_used_at`
- `unsubscribe_token`, `unsubscribe_expires_at`, `unsubscribe_used_at`

Rationale: at most two tokens per subscription with fixed scopes; tokens have no identity outside the aggregate; single-table load/save is simpler.

**Status lifecycle** — replace `confirmed: boolean` with `status: pending | confirmed | unsubscribed`:

- Unsubscribe sets **`unsubscribed`** instead of deleting the row.
- Supports re-subscription without losing history.
- HTTP API still exposes `confirmed: boolean` in the DTO for backward compatibility.

Migrations: `0005_inline_subscription_tokens`, `0006_rename_subscribe_token_to_confirm`.

Subscription IDs change from serial integers to string UUIDs.

## Consequences

**Positive**

- Each service has a single clear responsibility; dependency graph is easier to reason about.
- Aggregate and database schema align — tokens are part of the subscription row.
- Soft unsubscribe preserves data for reactivation and auditing.

**Negative / trade-offs**

- `ScannerService` → `SubscriptionService` adds an indirection layer for scan-related subscription updates.
- Inlined token columns widen the `subscriptions` table; acceptable while tokens remain bounded to the aggregate.
- String subscription IDs require updates across repository and API mapping code.
