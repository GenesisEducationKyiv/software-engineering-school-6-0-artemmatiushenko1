# Architecture Decision Records

Short, self-contained records of significant architectural choices. Each ADR captures **context**, **decision**, and **consequences**.

| ADR                                                          | Title                                      | Status   | Source                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------- |
| [0001](./0001-functional-testing-strategy.md)                | Functional testing strategy                | Accepted | [PR #3 — HW5](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/3)     |
| [0002](./0002-dependency-injection-and-app-composition.md)   | Dependency injection and app composition   | Accepted | [PR #3 — HW5](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/3)     |
| [0003](./0003-observability-stack.md)                        | Observability stack                        | Accepted | [PR #5 — HW6](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/5)     |
| [0004](./0004-rich-subscription-domain-model.md)             | Rich subscription domain model             | Accepted | [PR #6 — HW4/HW7](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/6) |
| [0005](./0005-service-boundaries-and-subscription-schema.md) | Service boundaries and subscription schema | Accepted | [PR #6 — HW4/HW7](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/6) |
| [0006](./0006-bounded-context-modules-and-platform.md)       | Bounded context modules and platform layer | Accepted | [PR #11 — HW7](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/11)   |
| [0007](./0007-use-cases-and-cross-module-ports.md)           | Use cases and cross-module ports           | Accepted | [PR #11 — HW7](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/11)   |
| [0008](./0008-in-process-event-bus.md)                       | In-process event bus                       | Accepted | [PR #12 — HW8](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/12)   |
| [0009](./0009-module-read-models-and-schemas.md)             | Module read models and per-module schemas  | Accepted | [PR #12 — HW8](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/12)   |
| [0010](./0010-transactional-outbox-and-relay.md)             | Transactional outbox and relay             | Accepted | [PR #9 — HW9](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/9)     |
| [0011](./0011-subscriber-idempotency.md)                     | Subscriber idempotency                     | Accepted | [PR #9 — HW9](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/9)     |
| [0012](./0012-grpc-subscription-api.md)                      | gRPC subscription API                      | Accepted | [PR #10 — HW10](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/10)  |

## Format

```text
docs/adr/NNNN-short-title.md
  Status   — Accepted | Superseded | Deprecated
  Context  — Problem and constraints
  Decision — What we chose and why
  Consequences — Trade-offs and follow-ups
```
