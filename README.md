# REST + Docker Quickstart

This document explains how to run the application with Docker and test the REST endpoints implemented for metrics ingestion and reporting.

Author: John ALLOU

## Prerequisites

- Docker 

## Run with Docker

From the project root:

```bash
docker compose up -d --build
```

Check running services:

```bash
docker compose ps
```

Expected exposed ports:

- App: `3000`
- Postgres: `5432`
- Redis: `6379`

Swagger UI:

- `http://localhost:3000/api-docs`

Stop services:

```bash
docker compose down
```

## Docker Compose Composition

The stack is defined in `docker-compose.yml` with three services:

- `postgres`: PostgreSQL with persistent volume `postgres_data`
- `redis`: Redis used for distributed locking and runtime cache/coordination
- `app`: NestJS backend container

Configuration strategy:

- `.env` is the single source of truth for database, redis and app settings.

Service responsibilities:

- **postgres**
  - Runs the primary relational datastore
  - Uses `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`
  - Exposes healthcheck via `pg_isready`

- **redis**
  - Runs the Redis instance used by Redlock
  - Uses `REDIS_PORT`
  - Exposes healthcheck via `redis-cli ping`

- **app**
  - Builds from `Dockerfile`
  - Receives build-time `DATABASE_URL` for Prisma client generation
  - Receives runtime variables from `.env` plus docker-network overrides (`DATABASE_URL` host=`postgres`, `REDIS_HOST=redis`)
  - Waits for healthy `postgres` and `redis` before starting

## Important Notes

- Event ingestion is exposed via REST (`POST /events`).
- Metrics query is exposed via REST (`GET /metrics`, `GET /metrics/dau` and `GET /metrics/wau`).
- `DAU` is stored per day.
- `WAU` is computed from daily activity over the query range.
- Duplicate `event_id` values are rejected with `409 Conflict`.

## Architecture Overview (Code Navigation)

The backend follows a modular NestJS architecture centered around a `MetricsModule`:

- **Entry point**: `src/main.ts` (app bootstrap, Swagger, global setup)
- **Root module**: `src/app.module.ts` (Config, Prisma, Metrics, Scheduler, Redis/Redlock)
- **Feature module**: `src/metrics/metrics.module.ts` (controllers, services, repositories, pipes)

Quick map:

```text
src/
  app.module.ts
  main.ts
  prisma/
    prisma.module.ts
    prisma.service.ts
  metrics/
    controllers/   -> HTTP routes
    services/      -> business logic (ingestion, DAU/WAU queries, aggregation)
    repositories/  -> database access via Prisma
    pipes/         -> input validation/transformation
    scheduler/     -> cron trigger for aggregation
    models/        -> domain interfaces used by repositories/services
    dto/           -> API contracts
```

Recommended reading order to explore quickly:

1. `src/metrics/controllers/events.controller.ts` and `src/metrics/controllers/metrics.controller.ts`
2. `src/metrics/services/event-ingestion.service.ts` and `src/metrics/services/dau-query.service.ts`
3. `src/metrics/services/dau-aggregation.service.ts` and `src/metrics/scheduler/dau-aggregation.scheduler.ts`
4. `src/metrics/repositories/*.ts` then `src/metrics/models/*.ts`
5. `prisma/schema.prisma` and `prisma/seed.ts`

Main runtime flows:

- **Ingestion flow (`POST /events`)**
  - Controller -> `CreateEventDtoPipe` -> `EventIngestionService`
  - Service enforces idempotency (`event_id` uniqueness) and persists activity
  - DAU metric is incremented atomically for the target day/feature/company

- **Query flow (`GET /metrics/dau`, `GET /metrics/wau`, `GET /metrics`)**
  - Controller -> `GetDauMetricsQueryPipe` -> `DauQueryService`
  - DAU reads from daily aggregated table
  - WAU is derived from distinct active users grouped by ISO week

- **Scheduled aggregation flow (cron)**
  - `DauAggregationScheduler` triggers `DauAggregationService.runOnce()`
  - `Redlock` provides distributed lock safety to avoid concurrent duplicate aggregation jobs

## REST Endpoints to Test

Base URL:

```text
http://localhost:3000
```

### 1) Ingest Event

**POST** `/events`

Body:

```json
{
  "event_id": "evt_postman_001",
  "user_id": "user_mock_123",
  "feature": "message_sent",
  "timestamp": "2025-11-01T10:00:00Z"
}
```

Success response (`201`):

```json
{
  "event_id": "evt_postman_001",
  "feature": "message_sent",
  "metric_key": "DAU-message_sent",
  "occurred_day_utc": "2025-11-01"
}
```

Duplicate response (`409`), if same `event_id` is sent again.

### 2) Query DAU Metrics

**GET** `/metrics/dau?from=2025-11-01&to=2025-11-07&feature=message_sent`

Example:

```text
http://localhost:3000/metrics/dau?from=2025-11-01&to=2025-11-07&feature=message_sent
```

Typical DAU response:

```json
[
  {
    "metric_key": "DAU-message_sent",
    "metric_value": 1,
    "partition_timestamp": "2025-11-01"
  },
  {
    "metric_key": "DAU-message_sent",
    "metric_value": 2,
    "partition_timestamp": "2025-11-02"
  },
]
```

### 3) Query WAU Metrics

**GET** `/metrics/wau?from=2025-11-01&to=2025-11-07&feature=message_sent`

Typical WAU response:

```json
[
  {
    "metric_key": "WAU-message_sent",
    "metric_value": 2,
    "partition_timestamp": "2025_wk44"
  }
]
```

### 4) Query DAU + WAU Metrics (Combined)

**GET** `/metrics?from=2025-11-01&to=2025-11-07&feature=message_sent`

Typical combined response:

```json
[
  {
    "metric_key": "DAU-message_sent",
    "metric_value": 1,
    "partition_timestamp": "2025-11-01"
  },
  {
    "metric_key": "DAU-message_sent",
    "metric_value": 2,
    "partition_timestamp": "2025-11-02"
  },
  {
    "metric_key": "WAU-message_sent",
    "metric_value": 2,
    "partition_timestamp": "2025_wk44"
  }
]
```

### Optional Filters

You can also filter by company:

```text
/metrics/dau?from=2025-11-01&to=2025-11-07&company_id=company_mock_456&feature=message_sent
```

Default company IDs available for filtering:

- `company_mock_456` (mock user: `user_mock_123`)
- `company_mock_789` (mock user: `user_mock_789`)

Seeded mock user IDs available for event ingestion:

- `user_mock_123`
- `user_mock_2`
- `user_mock_3`
- `user_mock_789`

For the full API contract, request/response schemas, and interactive testing, use Swagger:
`http://localhost:3000/api-docs`

## Logs

Follow app logs:

```bash
docker compose logs -f app
```

If scheduler logs are enabled, you should see periodic aggregation traces in app logs.
