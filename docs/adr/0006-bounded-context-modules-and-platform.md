# ADR-0006: Bounded context modules and platform layer

**Status:** Accepted  
**Date:** 2026-06-30  
**Source:** [PR #11 — HW7 Bounded contexts](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/11)

## Context

The codebase used service folders (`src/services/`) with a shared top-level `src/domain/` and `src/infrastructure/`. Boundaries between subscription, notification, scanner, and GitHub integration were unclear, and cross-cutting code was mixed with feature logic.

## Decision

Replace service folders with explicit bounded contexts under `src/modules/`:

```text
src/modules/<context>/
  api/              # public contracts for other modules
  application/      # use cases, ports, application errors
  domain/           # aggregates, value objects, domain errors
  infrastructure/   # DB, HTTP controllers, external clients
  <context>.module.ts
```

Four contexts:

| Module           | Responsibility                                      |
| ---------------- | --------------------------------------------------- |
| **subscription** | Subscribe, confirm, unsubscribe, list subscriptions |
| **notification** | Email delivery and templates                        |
| **github**       | GitHub API client, caching, rate-limit errors       |
| **scanner**      | Release scanning cron and `ScanUseCase`             |

**Dedicated `github` module** — subscription and scanner both need GitHub, but neither should own Octokit. The module acts as an anti-corruption layer (`GithubClient`, `GithubRelease` ports) and hosts shared Redis caching (`CachedOctokitGithubClient`) once.

**`platform` layer** — rename `src/infrastructure/` → `src/platform/` for shared technical adapters only:

- `platform/db/`, `platform/http/`, `platform/metrics/`, `platform/logger/`, `platform/fastify/`

Module-specific adapters (repositories, email client, Octokit wrapper) stay inside their module.

**`shared-kernel/`** — move `Clock`, `IdGenerator`, `Logger`, `TransactionManager` from `src/domain/shared/`; framework-free contracts not owned by any one context.

**Domain colocation** — remove top-level `src/domain/`; each module owns its domain package. Domain purity check scans `src/modules/*/domain/`.

**Per-module metrics** — replace monolithic `src/domain/metrics.ts` with module-specific ports (`NotificationMetrics`, `ScannerMetrics`, `CacheMetrics`); `platform/metrics/metrics.interface.ts` composes them for the composition root.

**Per-module config** — `modules/<context>/config.ts` for github, notification, and scanner settings; root `config.ts` composes `AppConfig` from module configs plus app-level DB/Redis/HTTP settings.

**HTTP colocation** — remove `src/routes/`; subscription controllers live under `subscription/infrastructure/http/`. Health and metrics routes stay in `platform/http/`.

## Consequences

**Positive**

- Each context has a predictable layout and a clear public API surface (`api/`).
- GitHub integration and caching live in one place; consumers depend on narrow ports.
- Platform code is distinguishable from business modules.

**Negative / trade-offs**

- More folders and module entrypoints to navigate.
- `AppContainer` must know construction order for all modules.
- Shared kernel types still require discipline to avoid becoming a junk drawer.
