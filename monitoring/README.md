# Monitoring stack

Prometheus, Grafana, and the optional ELK logging pipeline (Elasticsearch, Kibana, Filebeat).

These services are defined in `docker-compose.yaml` in this folder and are meant to run **together with** the app stack in the repository root. Compose merges both files into one project so services share a network and can reach `app` by hostname.

> **Important:** Run all commands from the **repository root**. Volume paths in `monitoring/docker-compose.yaml` are relative to the project root (e.g. `./monitoring/prometheus/...`), not this folder.

## Commands (run from repository root)

**Metrics only** (Prometheus + Grafana):

```bash
docker compose -f docker-compose.yaml -f monitoring/docker-compose.yaml up --build -d
```

**Metrics + structured logging** (adds Elasticsearch, Kibana, Filebeat):

```bash
docker compose -f docker-compose.yaml -f monitoring/docker-compose.yaml --profile logging up --build -d
```

**App only** (no monitoring):

```bash
docker compose up --build -d
```

Optional: set in `.env` so you can omit `-f` flags:

```bash
COMPOSE_FILE=docker-compose.yaml:monitoring/docker-compose.yaml
```

## Layout

- `prometheus/` — scrape config (`app:3000/metrics`)
- `grafana/` — datasource provisioning (Prometheus)
- `filebeat/` — ship `github-release-notifier-app` container logs to Elasticsearch

## URLs

| Service     | URL                      |
|-------------|--------------------------|
| Prometheus  | http://localhost:9090    |
| Grafana     | http://localhost:3001    |
| Elasticsearch | http://localhost:9200 |
| Kibana      | http://localhost:5601    |
