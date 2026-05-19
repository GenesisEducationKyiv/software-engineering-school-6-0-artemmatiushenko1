# GitHub Release Notification API

[![CI](https://github.com/artemmatiushenko1/github-release-notifier/actions/workflows/ci.yaml/badge.svg)](https://github.com/artemmatiushenko1/github-release-notifier/actions/workflows/ci.yaml)

![Client Screenshot](./docs/image.png)

A monolith service that allows users to subscribe to email notifications about new releases of any public GitHub repository.

## Features

- **Subscription Management**: Subscribe, confirm, and unsubscribe from repository release notifications.
- **Automated Scanning**: Periodically checks for new releases using a cron job.
- **Email Notifications**: Sends formatted emails when a new release is detected.
- **GitHub API Integration**: Validates repository existence and fetches the latest release data.
- **Caching**: Redis-based caching for GitHub API responses to respect rate limits (10-minute TTL).
- **Monitoring**: Prometheus metrics for tracking system health, scanner performance, and cache efficiency.
- **API Documentation**: Integrated Swagger UI for interactive API exploration.
- **Modern Tech Stack**: Built with Fastify, TypeScript, Drizzle ORM, and PostgreSQL.

## Client Application

The service includes a built-in React-based frontend to provide a user-friendly experience for managing subscriptions. When the server is running, you can access the following pages:

- **Subscription Page (`/`)**: The main landing page where users can enter their email and a GitHub repository path to subscribe.
- **Confirmation Page (`/confirm/:token`)**: The page users land on after clicking the link in their confirmation email to activate their subscription.
- **Unsubscribe Page (`/unsubscribe/:token`)**: A dedicated page for users to easily opt-out of notifications using their unique token.
- **Success Page (`/sent`)**: A feedback page shown after a successful subscription request, instructing the user to check their email.

## Business Logic

The service operates on two core processes: **Subscription Management** and **Automated Release Scanning**.

### 1. Subscription Lifecycle

- **Subscription Request**: Validates email and repository path (`owner/repo`). It checks repository existence via GitHub API and ensures no duplicate subscriptions exist. A pending subscription and secure tokens (confirm/unsubscribe) are created, and a confirmation email is sent.
- **Confirmation**: Upon clicking the link, the subscription becomes active, and an initial scan is triggered to capture the current `last_seen_tag`. This ensures users only receive notifications for _future_ releases.
- **Unsubscription**: Users can opt-out at any time using a unique token provided in every email.

### 2. Automated Release Scanning

- **Scheduled Scans**: A cron job (default: every 10 minutes) triggers the scanner for all confirmed subscriptions.
- **Change Detection**: The scanner fetches the latest release from GitHub and compares it with the `last_seen_tag` in the database.
- **Notification**: If a new tag is detected, the service sends an email to the subscriber and updates the `last_seen_tag` to prevent duplicate alerts.
- **Rate Limit Handling**: The service gracefully handles GitHub API rate limits (HTTP 429) and uses Redis caching to minimize redundant API calls.

## Tech Stack

- **Runtime**: Node.js (v22+)
- **Language**: TypeScript
- **Web Framework**: Fastify
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Cache**: Redis (ioredis)
- **Validation**: Zod
- **Metrics**: Prometheus (prom-client)
- **Email**: Nodemailer
- **Testing**: Vitest
- **Scheduling**: node-cron
- **API Client**: Octokit

## Getting Started

### Prerequisites

- Docker and Docker Compose
- A GitHub Personal Access Token (optional, but recommended to avoid rate limits)
- A Gmail account with OAuth2 credentials (for sending emails)

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Fill in the required variables in `.env`:
   - `DATABASE_URL`: PostgreSQL connection string.
   - `REDIS_URL`: Redis connection string.
   - `GITHUB_TOKEN`: Your GitHub PAT.
   - `GMAIL_USER_EMAIL`: Your Gmail address.
   - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`: Your Google OAuth2 credentials.

### Running with Docker (Recommended)

The easiest way to run the entire system is using Docker Compose:

```bash
docker-compose up --build
```

Once the containers are running, the application will be accessible at:

- **Web Interface**: [http://localhost:3000](http://localhost:3000)
- **API Documentation (Swagger)**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Prometheus Metrics**: [http://localhost:3000/metrics](http://localhost:3000/metrics)

### Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (requires local Postgres and Redis):
   ```bash
   npm run dev
   ```

## Monitoring & Metrics

- **Metrics Endpoint**: `http://localhost:3000/metrics`
- **Key Indicators**:
  - `subscription_requests_total`: Total number of subscription attempts.
  - `notifications_sent_total`: Total number of emails sent.
  - `scanner_runs_total`: Total number of repository scans.
  - `cache_hits_total`: GitHub API cache hit count.
  - `cache_misses_total`: GitHub API cache miss count.

## Testing

The project includes a comprehensive test suite covering unit, integration, and end-to-end (E2E) scenarios.

### Unit & Integration Tests

These tests cover individual components and their interactions. They use **PGlite** (a WASM-based in-memory PostgreSQL) to provide a real database environment with high performance and no external dependencies.

```bash
npm test
```

### End-to-End (E2E) Tests

E2E tests verify the complete user flow from the frontend to the backend. These tests run against a real database and Redis instance.

1.  **Build the client**:
    ```bash
    npm run build --prefix client
    ```
2.  **Start required services**: Ensure the database and Redis are running (without the API service):
    ```bash
    docker compose up -d db redis
    ```
3.  **Run E2E tests**:
    ```bash
    npm run test:e2e
    ```

## Project Structure

- `src/domain`: Core business logic and interfaces.
- `src/infrastructure`: Implementations of external services (DB, GitHub, Email, Metrics).
- `src/services`: Application services orchestrating domain logic.
- `src/routes`: API route definitions.
- `client/`: Frontend application code.
- `drizzle/`: Database migrations.

## Database Schema

The service uses PostgreSQL with the following schema, managed by Drizzle ORM:

```mermaid
erDiagram
    subscriptions ||--o{ subscription_tokens : "has"
    subscriptions {
        serial id PK
        text email
        text repo
        boolean confirmed
        text last_seen_tag
        timestamp created_at
    }
    subscription_tokens {
        serial id PK
        text token
        integer subscription_id FK
        scope_enum scope
        timestamp expires_at
        timestamp created_at
    }
```
