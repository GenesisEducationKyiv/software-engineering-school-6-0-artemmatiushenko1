# ADR-0004: Rich subscription domain model

**Status:** Accepted  
**Date:** 2026-06-24  
**Source:** [PR #6 — HW4/HW7 SOLID & Modular monolith prep](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/6)

## Context

Business rules for subscriptions (token validity, state transitions, email/repo validation) lived in services and Zod schemas. That made the core logic hard to unit test without databases or HTTP, and allowed infrastructure concerns to leak into application code.

## Decision

Introduce a framework-free subscription domain under `src/domain/subscription/`:

| Building block               | Responsibility                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| **`Subscription` aggregate** | State transitions: `request` → `confirm` → `unsubscribe`, reactivation, release observation            |
| **Value objects**            | `Email`, `RepoPath`, `ReleaseTag`, `SubscriptionToken` — validation and invariants on construction/use |
| **Enums**                    | `SubscriptionStatus`, `SubscriptionTokenScope`                                                         |
| **Domain errors**            | Colocated errors (`IllegalStateTransitionError`, `TokenExpiredError`, etc.)                            |

Application layer changes:

- **`SubscriptionService`** orchestrates use cases and delegates rules to the aggregate.
- **`DrizzleSubscriptionRepository`** + **`subscription-row.mapper.ts`** map between DB rows and domain objects at the infrastructure boundary. Zod validates row shape only, not domain logic.
- Domain unit tests under **`tests/domain/`**.

Cross-cutting ports under **`src/domain/shared/`**:

- **`Clock`** — injectable time (deterministic in tests).
- **`IdGenerator`**, **`TokenGenerator`** — implemented in infrastructure (`CryptoIdGenerator`, `CryptoTokenGenerator`).

Enforcement:

- **`tests/architecture/domain-purity.test.ts`** — fails if domain/application code imports `pg`, `drizzle`, `fastify`, `zod`, etc.
- Runs with `npm test` (pre-commit and CI).

## Consequences

**Positive**

- Business rules are testable in isolation without mocks for the entire stack.
- Domain layer has no framework imports; persistence mapping is explicit at the repository boundary.
- Injectable `Clock` / generators remove hidden `Date.now()` and `randomUUID()` from services.

**Negative / trade-offs**

- More mapping code between DB rows and rich domain objects.
- Domain purity architecture test catches obvious forbidden imports, not all architectural leaks.
- Token lifecycle moves into the aggregate; the separate token manager abstraction is removed.
