# ADR-0007: Use cases and cross-module ports

**Status:** Accepted  
**Date:** 2026-06-30  
**Source:** [PR #11 — HW7 Bounded contexts](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/11)

## Context

`SubscriptionService` bundled all subscription operations in one class (~190 lines, one test file). The scanner depended on that full interface even though it only needed read/update operations for confirmed subscriptions. Application errors and domain invariants were not clearly separated.

## Decision

### Split subscription into use cases

Replace `SubscriptionService` with:

- `SubscribeUseCase`
- `ConfirmUseCase`
- `UnsubscribeUseCase`
- `GetSubscriptionsByEmailUseCase`

Each use case has dedicated unit tests. Application errors (`RepoNotFoundError`, `AlreadySubscribedError`, …) live in `application/errors.ts`; domain invariants stay in `domain/errors.ts`.

### `SubscriptionQueries` cross-module port

Expose a narrow read/write API for the scanner in `api/subscription-queries.interface.ts`:

- `findAllConfirmedSubscriptions()` — subscriptions to scan
- `observeNewRelease()` — persist new `lastSeenTag` after a release is detected

The scanner depends on this 2-method port instead of the full subscription service. Subscription owns persistence and invariants; scanner requests data and reports observations back.

### Scanner orchestration

`ScanUseCase` coordinates the cross-context release-detection workflow synchronously:

1. Load subscriptions via `SubscriptionQueries`
2. Fetch latest release via `GithubClient`
3. Notify via `NotificationService.notifyNewRelease()`
4. Update `lastSeenTag` via `SubscriptionQueries.observeNewRelease()`

`ScanCron` lifecycle (`startCron` / `stopCron`) is owned by `ScannerModule`; `App` delegates start/stop at boot and shutdown.

### Composition and HTTP errors

- **`AppContainer`** constructs modules in dependency order and exposes `AppDependencies`. DB, Redis, metrics, and clock are injected from `index.ts`.
- **`platform/http/domain-error-registry.ts`** maps domain and application errors to HTTP status codes; `App` uses `isDomainError` / `resolveDomainErrorHttpResponse` globally.
- **`GithubModule`** and **`NotificationModule`** build their clients from module config in production, or accept injected clients in tests.

## Consequences

**Positive**

- Use cases are small, testable units with clear responsibilities.
- Scanner coupling to subscription is limited to `SubscriptionQueries`, not write operations.
- Centralized error mapping removes ad-hoc handling in route handlers.

**Negative / trade-offs**

- `ScanUseCase` still depends on `SubscriptionQueries` and `NotificationService` at compile time and orchestrates them synchronously.
- More wiring in `AppContainer` and each `*.module.ts`.
- Cross-module ports must be kept minimal to avoid becoming a second shared service layer.
