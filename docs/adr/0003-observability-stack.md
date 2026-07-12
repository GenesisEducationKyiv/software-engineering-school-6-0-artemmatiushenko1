# ADR-0003: Observability stack

**Status:** Accepted  
**Date:** 2026-06-13  
**Source:** [PR #5 — HW6 Logging pipeline](https://github.com/GenesisEducationKyiv/software-engineering-school-6-0-artemmatiushenko1/pull/5)

## Context

Operating the notifier in Docker required visibility into request failures, scanner behaviour, and email delivery without SSH-ing into containers. Ad-hoc logging was unstructured and uncorrelated. The `/metrics` endpoint was reachable on the public port, which is undesirable in production.

## Decision

### Logging

- **Pino** via Fastify — JSON logs to stdout in production; pretty output when `NODE_ENV=development`. Log level fixed at `info`.
- **Logger config** extracted to `src/infrastructure/logger/create-fastify-logger-options.ts`.
- **`x-request-id`** — Fastify reads or generates the header; echoed on every response.
- **`AsyncLocalStorage`** request log context — service-layer logs, error handlers, and `onResponse` hooks share the same `requestId`.
- Custom **`onResponse`** access log (method, route, status, duration); Fastify's default request logger disabled.

### Metrics

- **HTTP RED** — `http_server_requests_total` + `http_server_request_duration_seconds` histogram, labelled by method, route, and status code. Recorded in the `onResponse` hook.
- **Business counters** where HTTP RED is insufficient: `notifications_sent_total`, scanner run/failure/duration metrics, GitHub API cache hits/misses.
- **Removed redundant counters** — `subscription_requests_total`, `subscription_confirmations_total`, `unsubscribe_requests_total` duplicated HTTP route metrics.
- **No high-cardinality labels** — removed `repo` label from business counters.

### Infrastructure layout

- **nginx** on host port 3000 → proxies to `app`; returns **403 for `/metrics`**. The `app` container is not published to the host directly.
- **Prometheus** scrapes `app:3000/metrics` on the internal Docker network.
- **Optional monitoring stack** in `monitoring/docker-compose.yaml` — Prometheus, Grafana (provisioned dashboard), Filebeat → Elasticsearch → Kibana.
- Filebeat reads Docker container logs, decodes JSON fields, and filters to the `github-release-notifier-app` container.

```text
User → nginx:3000 → app (HTTP)
Prometheus → app:3000/metrics (internal only)
app stdout → Filebeat → Elasticsearch → Kibana
```

## Consequences

**Positive**

- Logs are searchable in Kibana; metrics visible in Grafana without code changes.
- Request correlation works end-to-end for support and debugging.
- Metrics endpoint is not exposed to the public internet.

**Negative / trade-offs**

- Monitoring stack adds significant Docker resource usage (Elasticsearch especially).
- Log level fixed at `info` — no runtime tuning without redeploy.
- RED metrics label by route template — routes must register stable names.
