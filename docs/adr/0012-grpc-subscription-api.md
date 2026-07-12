# ADR-0012: gRPC subscription API

**Status:** Accepted  
**Date:** 2026-07-06  
**Source:** [PR #10 — HW10 gRPC](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/10)

## Context

Subscription lifecycle was exposed only over REST (Fastify controllers → use cases). Course requirements included a gRPC interface as an optional extra. Adding a second transport should not duplicate business logic or error-mapping rules already centralized for HTTP.

## Decision

Expose subscription operations over **gRPC alongside REST**. Handlers delegate to the same use cases as HTTP controllers; domain writes still go through the outbox (ADR-0010).

### Proto contract

`subscription/api/subscription.proto` defines `SubscriptionService` with four unary RPCs mirroring the REST API:

| RPC                 | REST equivalent                 |
| ------------------- | ------------------------------- |
| `Subscribe`         | `POST /api/subscribe`           |
| `Confirm`           | `GET /api/confirm/{token}`      |
| `Unsubscribe`       | `GET /api/unsubscribe/{token}`  |
| `ListSubscriptions` | `GET /api/subscriptions?email=` |

### Platform gRPC package (`platform/grpc/`)

Shared transport infrastructure, not module-specific logic:

| Piece                                                            | Role                                                                                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`createGrpcServer` / `bindGrpcServer` / `shutdownGrpcServer`** | Server lifecycle                                                                                                                                        |
| **`load-proto.ts`**                                              | Proto-loader fallback for package definition loading                                                                                                    |
| **`domain-error-grpc.ts`**                                       | Maps registered domain errors to gRPC `StatusObject` (`code`, `details`, `metadata` with `domain_error_code`); reuses `domain-error-registry` from HTTP |
| **`runUnary`**                                                   | Shared unary wrapper: success callback, domain-error mapping, `INTERNAL` for unexpected errors                                                          |

### Module handlers (`subscription/infrastructure/grpc/`)

- **`createSubscriptionServiceHandlers`** — wires `SubscriptionModule` use cases into generated `SubscriptionServiceServer` handlers via `runUnary`
- **`registerSubscriptionGrpc`** — registers the service on the shared gRPC server at startup

Handler tests cover delegation and response mapping only; domain-error → status mapping is tested in `platform/grpc/`.

### Code generation and tooling

- **`npm run proto:generate`** — **ts-proto** generates TypeScript types and service definitions into `infrastructure/grpc/generated/` (gitignored)
- **`protoc`** required locally and in CI/Docker; Dockerfile runs `proto:generate` at build time
- No automatic pre-dev/pre-test hooks — generation is manual after install or proto changes (documented in README)

### App wiring

- gRPC server starts alongside Fastify in `index.ts`; graceful shutdown in `App.stop()`
- Config: `GRPC_HOST` (default `0.0.0.0`), `GRPC_PORT` (default `50051`)
- Docker Compose publishes `50051:50051`

```text
gRPC client → :50051 → SubscriptionService handlers → runUnary → use cases → Postgres + outbox
```

## Consequences

**Positive**

- REST and gRPC share use cases and domain error semantics — one business layer, two transports.
- Platform helpers (`runUnary`, `domain-error-grpc`) are reusable if other modules add gRPC later.
- Generated code stays out of version control; proto file is the contract source of truth.

**Negative / trade-offs**

- Only the **subscription** module has gRPC handlers; scanner and notification remain event-driven only.
- Server uses **insecure** credentials (`createInsecure`) — no TLS on the gRPC port.
- Build and CI depend on `protoc`; missing generation step causes type-check failures.
- Proto and Swagger must be kept in sync manually when the REST contract changes.
