# ADR-0001: Functional testing strategy

**Status:** Accepted  
**Date:** 2026-06-21  
**Source:** [PR #3 — HW5 Functional testing](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/3)

## Context

The service handles a multi-step subscription lifecycle (subscribe → confirm email → scan releases → notify). Bugs often appear only when HTTP, database, email, and GitHub interact. We needed fast feedback in CI without a live Postgres instance for every test run, and E2E coverage without hitting real GitHub rate limits or sending real email.

## Decision

Adopt a test pyramid with **static checks** at the base, then unit → integration → E2E:

```text
        ┌─────────┐
        │   E2E   │  Playwright + Docker Compose
        ├─────────┤
        │ Integr. │  Vitest + PGlite
        ├─────────┤
        │  Unit   │  Vitest + vitest-mock-extended
        ├─────────┤
        │ Static  │  lint, format, type-check
        └─────────┘
```

| Layer           | Tooling                              | Scope                                                     |
| --------------- | ------------------------------------ | --------------------------------------------------------- |
| **Static**      | ESLint, Prettier, `tsc`              | Style and compile-time correctness — no runtime           |
| **Unit**        | Vitest + `vitest-mock-extended`      | Domain logic and isolated components with type-safe mocks |
| **Integration** | Vitest + **PGlite** (WASM Postgres)  | HTTP handlers and DB behaviour with real SQL, no Docker   |
| **E2E**         | **Playwright** in **Docker Compose** | Full user flow: UI → API → DB → Mailpit → GitHub mock     |

Static checks run in CI before tests:

| Check  | Command                | Purpose                                   |
| ------ | ---------------------- | ----------------------------------------- |
| Format | `npm run format:check` | Consistent code style (Prettier)          |
| Lint   | `npm run lint`         | ESLint rules                              |
| Types  | `npm run type-check`   | Compile-time correctness (`tsc --noEmit`) |

Additional choices:

- **Mailpit** in E2E: assert confirmation/unsubscribe emails via Mailpit API instead of stubbing the mailer.
- **GitHub mock server** in E2E: simulate repo/release state without external API calls.
- **Zod-validated response helpers** (`src/utils/test.utils.ts`): integration tests assert responses match expected schemas.
- **CI pipeline order**: static checks → unit/integration (Vitest) → E2E (`docker-compose.e2e.yaml`) with Playwright report artifacts on failure.
- **Dockerized E2E** (`Dockerfile.e2e`, `docker-compose.e2e.yaml`): same environment locally and in CI.

## Consequences

**Positive**

- Static checks fail in seconds with no test runtime.
- Integration tests use a real Postgres dialect (PGlite) — catches SQL and migration issues unit mocks miss.
- E2E runs the same stack locally and in CI; Mailpit + GitHub mock remove flaky external dependencies.
- Clear separation: static analysis → fast Vitest tests → slow Playwright flows.

**Negative / trade-offs**

- E2E suite is slower and heavier (Docker build, Playwright browser).
- PGlite is not identical to production Postgres (extensions, performance).
- Two compose files to maintain (`docker-compose.yaml` vs `docker-compose.e2e.yaml`).
