# ADR-0002: Dependency injection and app composition

**Status:** Accepted  
**Date:** 2026-06-21  
**Source:** [PR #3 — HW5 Functional testing](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/3)

## Context

Early code wired services through globals and ad-hoc imports, making unit tests brittle and startup/shutdown logic scattered across `index.ts`. We needed a composition root that builds the object graph once, allows swapping infrastructure in tests, and centralises lifecycle concerns (migrations, routes, graceful shutdown).

## Decision

1. **`AppContainer`** (`src/dependencies.ts`) — lazy composition root that constructs services, repositories, and infrastructure clients (DB, Redis, GitHub, email, metrics) and exposes `build()` → `AppDependencies`.
2. **`App` class** (`src/app.ts`) — static factory (`App.create`) owns database migrations, Swagger setup, route registration, HTTP hooks, and graceful shutdown.
3. **Constructor injection everywhere** — components receive dependencies via constructors; no global state for business or infrastructure code.
4. **Thin `index.ts`** — bootstrap only: load config → create container → start application.
5. **Unified HTTP errors** — `DomainError` hierarchy + Zod-validated response DTOs; one error handler maps domain errors to HTTP status codes.
6. **Modular Fastify plugins** — `/health`, `/metrics`, and feature routes registered as separate route plugins.

```text
index.ts → AppContainer.build() → App.create(fastify) → route plugins
                ↓
         services, repositories, clients
```

## Consequences

**Positive**

- Tests inject mocks through the container or directly into constructors.
- Startup and shutdown paths are explicit and testable.
- New services or clients plug in at the composition root without changing domain logic.

**Negative / trade-offs**

- `AppContainer` grows as the application adds services; it is the single place that knows the full object graph.
- Manual DI (no Nest/Fx-style framework) — wiring is verbose but transparent.
