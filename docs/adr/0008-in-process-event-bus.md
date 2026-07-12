# ADR-0008: In-process event bus

**Status:** Accepted  
**Date:** 2026-07-01  
**Source:** [PR #12 — HW8 Message broker](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/12)

## Context

After bounded contexts were introduced (ADR-0006, ADR-0007), cross-module work still ran synchronously: `ScanUseCase` called `SubscriptionQueries` and `NotificationService` directly, and subscription use cases depended on `NotificationService` for email side effects. Compile-time coupling remained between subscription, scanner, and notification.

## Decision

Add an in-process event bus under `platform/event-bus/`:

| Piece                   | Role                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| **`EventBus`**          | `publish()` / `subscribe()` contract                               |
| **`InProcessEventBus`** | Synchronous in-memory dispatcher                                   |
| **`IntegrationEvent`**  | Typed envelope: `type`, `aggregateId`, `occurredAt`, `payload`     |
| **`EventSubscriber`**   | Base class; `registerEventSubscribers()` wires handlers at startup |

`AppContainer` owns one bus instance, injects it into publishers, and delegates subscriber registration to consumer modules.

### Subscription publishes; no cross-module service calls

The `Subscription` aggregate collects internal domain events. Use cases persist state, map to **public API events** in `subscription/api/events.ts`, then publish:

- `SubscriptionRequested`, `SubscriptionConfirmationRenewed`, `SubscriptionReactivated`
- `SubscriptionConfirmed`, `SubscriptionDeactivated`

**Removed from subscription module:**

- `NotificationService` dependency
- `SubscriptionQueries` cross-module port
- `GithubClient` from `ConfirmUseCase` — confirm is a pure lifecycle operation; `SubscriptionConfirmed` carries only subscription facts (`email`, `repo`, `unsubscribeToken`)

Subscription module has no event subscribers; it only publishes.

### Notification: subscribers replace `NotificationService`

The fat `NotificationService` interface and implementation are removed. One subscriber per email concern under `notification/application/subscribers/`:

| Event                             | Subscriber action                     |
| --------------------------------- | ------------------------------------- |
| `SubscriptionRequested`           | Send confirmation email               |
| `SubscriptionConfirmationRenewed` | Resend confirmation                   |
| `SubscriptionReactivated`         | Send reactivation confirmation        |
| `SubscriptionConfirmed`           | Create recipient + send welcome email |
| `SubscriptionDeactivated`         | Delete recipient                      |
| `NewReleaseDetected`              | Send release notification             |

Each subscriber owns its template and link logic. `NotificationModule.registerEventSubscribers(eventBus)` registers them.

### Scanner publishes release events

`ScanUseCase` publishes `NewReleaseDetected` events for eligible watchers instead of calling `NotificationService` or `SubscriptionQueries.observeNewRelease()`. `ScannerModule.registerEventSubscribers(eventBus)` wires projection subscribers (see ADR-0009).

## Consequences

**Positive**

- Subscription, scanner, and notification no longer import each other's application services for side effects.
- Public API events in `api/events.ts` define the cross-module contract explicitly.
- `EventBus` interface isolates dispatch mechanics from module code.

**Negative / trade-offs**

- Dispatch is synchronous and in-process — a subscriber failure or slow handler blocks the publisher's `publish()` call.
- Event ordering and error handling are the caller's problem; there is no durable queue or retry in this layer.
- More types and wiring: every new integration point needs an event type and one or more subscribers.
