# Software Design Document

GitHub Release Notifier is a **modular monolith**: one Node.js process that manages subscription lifecycle, scans GitHub for new releases, and sends email notifications.

## Deployment

```mermaid
flowchart LR
  User -->|":3000"| Nginx
  Nginx -->|"/api, UI, /health"| App
  Nginx -.->|"/metrics blocked"| Blocked403
  GrpcClient[gRPC client] -->|":50051"| App

  App --> Postgres
  App --> Redis
  App --> SMTP

  Prometheus -->|internal| App
  Prometheus --> Grafana
  App -->|JSON logs| Filebeat
  Filebeat --> Elasticsearch --> Kibana
```

- HTTP and the React UI go through **nginx** on port 3000; `/metrics` is blocked publicly.
- **gRPC** is exposed directly on port 50051.
- Optional monitoring stack: see [monitoring/README.md](../monitoring/README.md).

## Application architecture

```mermaid
flowchart TB
  subgraph transports [Transports]
    HTTP[Fastify HTTP]
    GRPC[gRPC]
  end

  subgraph modules [Bounded contexts]
    Sub[subscription]
    Scan[scanner]
    Notif[notification]
    GH[github]
  end

  subgraph platform [Platform]
    Outbox[Outbox + Relay]
    Bus[EventBus]
    Sched[Scheduler]
  end

  HTTP --> Sub
  GRPC --> Sub
  Sub --> Outbox
  Scan --> Outbox
  Outbox --> Bus
  Bus --> Notif
  Bus --> Scan
  Sub --> GH
  Scan --> GH
  Notif --> Email[SMTP]
  GH --> Redis
  GH --> GitHubAPI[GitHub API]
  Sched --> Outbox
  Sched --> Scan
```

Composition root: [`src/dependencies.ts`](../src/dependencies.ts) → [`src/app.ts`](../src/app.ts) → [`src/index.ts`](../src/index.ts).

## Bounded contexts

| Module           | Responsibility                        | Schema                                             |
| ---------------- | ------------------------------------- | -------------------------------------------------- |
| **subscription** | Subscribe, confirm, unsubscribe, list | `subscription.subscriptions`                       |
| **scanner**      | Repo-centric release scanning         | `scanner.monitored_repos`, `scanner.repo_watchers` |
| **notification** | Email templates and delivery          | `notification.notification_recipients`             |
| **github**       | Octokit client + Redis cache          | —                                                  |

Each module lives under `src/modules/<context>/` with `api/`, `application/`, `domain/`, `infrastructure/`. Cross-module imports go through `api/` only.

## Integration events

Use cases persist domain state and outbox rows in the **same transaction**. `OutboxRelay` polls pending messages and publishes to the in-process `EventBus`.

```mermaid
sequenceDiagram
  participant API as HTTP_or_gRPC
  participant UC as UseCase
  participant DB as Postgres
  participant Relay as OutboxRelay
  participant Bus as EventBus
  participant Sub as Subscribers

  API->>UC: command
  UC->>DB: write + outbox row
  Relay->>DB: fetch pending
  Relay->>Bus: publish
  Bus->>Sub: handlers
  Relay->>DB: mark processed
```

| Event                             | Publisher    | Consumers             |
| --------------------------------- | ------------ | --------------------- |
| `SubscriptionRequested`           | subscription | notification          |
| `SubscriptionConfirmationRenewed` | subscription | notification          |
| `SubscriptionReactivated`         | subscription | notification          |
| `SubscriptionConfirmed`           | subscription | notification, scanner |
| `SubscriptionDeactivated`         | subscription | notification, scanner |
| `NewReleaseDetected`              | scanner      | notification          |

Subscribers are idempotent (`platform.processed_deliveries`). Background jobs: scanner cron (`SCANNER_CRON`) and outbox relay (`OUTBOX_RELAY_CRON`).

## Data model

PostgreSQL uses separate schemas per context. `subscriptionId` links across schemas logically — no cross-schema FKs.

```mermaid
erDiagram
  subscriptions {
    text id PK
    text email
    text repo
    enum status
    text confirm_token
    timestamptz confirm_expires_at
    timestamptz confirm_used_at
    text unsubscribe_token
    timestamptz unsubscribe_used_at
    timestamptz created_at
  }
  monitored_repos {
    text repo PK
    text last_seen_tag
  }
  repo_watchers {
    text subscription_id PK
    text repo FK
    text last_notified_tag
  }
  notification_recipients {
    text subscription_id PK
    text email
    text unsubscribe_token
  }
  outbox_messages {
    text id PK
    text event_type
    text aggregate_id
    timestamptz occurred_at
    jsonb payload
    timestamptz created_at
    timestamptz processed_at
    int attempt_count
    text last_error
    timestamptz dead_lettered_at
  }
  processed_deliveries {
    text message_id PK
    timestamptz processed_at
  }
  monitored_repos ||--o{ repo_watchers : repo
```

## APIs

**REST** (via nginx `:3000`):

| Method | Path                        | Operation      |
| ------ | --------------------------- | -------------- |
| POST   | `/api/subscribe`            | Subscribe      |
| GET    | `/api/confirm/:token`       | Confirm        |
| GET    | `/api/unsubscribe/:token`   | Unsubscribe    |
| GET    | `/api/subscriptions?email=` | List confirmed |

**gRPC** (`:50051`): `Subscribe`, `Confirm`, `Unsubscribe`, `ListSubscriptions` — same use cases as REST. Proto: [`subscription.proto`](../src/modules/subscription/api/subscription.proto).

## Quality attributes

| Attribute           | Approach                                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reliability**     | Transactional outbox — domain writes and events are atomic. At-least-once delivery with idempotent subscribers (`processed_deliveries`). Dead-lettering after `OUTBOX_MAX_RETRIES`.                         |
| **Performance**     | Repo-centric scanning (one GitHub API call per repo). Redis cache for GitHub responses (`GITHUB_CACHE_TTL`).                                                                                                |
| **Operability**     | Structured JSON logs (Pino), HTTP RED metrics, business counters, outbox metrics. Optional Prometheus/Grafana/ELK stack. See [ADR-0003](./adr/0003-observability-stack.md).                                 |
| **Maintainability** | Bounded contexts with `api/` import boundaries. Architecture tests in `tests/architecture/`. ADRs for major decisions.                                                                                      |
| **Testability**     | DI via `AppContainer`; injectable clock, scheduler, and clients. Test pyramid: static → unit → integration (PGlite) → E2E (Docker + Playwright). See [ADR-0001](./adr/0001-functional-testing-strategy.md). |
| **Security**        | `/metrics` blocked at nginx. gRPC uses insecure credentials (no TLS) — not suitable for untrusted networks as-is.                                                                                           |

## Architecture decisions

Detailed rationale lives in [ADR index](./adr/README.md).
