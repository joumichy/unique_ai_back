# GraphQL + Docker Quickstart

This service ingests feature-usage events and exposes DAU and WAU metrics through GraphQL.

Author: John ALLOU

## Prerequisites

- Docker

## Run Locally

Create `.env` from `.env.example`, then run:

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

Notes:

- The application reads `.env`.
- `.env` is intended to be created by the user from `.env.example`.

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

GraphQL endpoint:

- `http://localhost:3000/graphql`

Stop services:

```bash
docker compose down
```

Notes:

- `app-init` is a one-shot bootstrap container.
- It runs `prisma migrate deploy`, which is idempotent and only applies pending migrations.
- It then runs the idempotent seed script so the demo users remain available on fresh databases.
- The `app` container starts only after `app-init` completes successfully.

## Architecture Overview

The backend keeps the same modular NestJS structure, but the transport layer is now GraphQL-only for metrics:

```text
src/
  app.module.ts
  main.ts
  prisma/
    prisma.module.ts
    prisma.service.ts
  metrics/
    graphql/
      inputs/   -> GraphQL mutation/query inputs
      models/   -> GraphQL response types
      metrics.resolver.ts
    services/   -> ingestion, aggregation, validation and query logic
    repositories/ -> database access via Prisma / SQL
    scheduler/  -> cron trigger for aggregation
    contracts/  -> service-level commands, queries and results
    models/     -> repository persistence shapes
```

Recommended reading order:

1. `src/metrics/graphql/metrics.resolver.ts`
2. `src/metrics/services/metrics-input-validator.service.ts`
3. `src/metrics/services/event-ingestion.service.ts`
4. `src/metrics/services/dau-query.service.ts`
5. `src/metrics/services/dau-aggregation.service.ts`
6. `src/metrics/repositories/*.ts`
7. `prisma/schema.prisma`

## Runtime Flows

- **Ingestion flow**
  - GraphQL mutation -> input validator -> `EventIngestionService`
  - Raw event is stored idempotently with unique `eventId`
  - Daily user activity is deduplicated by `(companyId, feature, userId, day)`
  - Ingestion stops there to avoid hot-row contention on the aggregate table

- **Query flow**
  - GraphQL query -> input validator -> `DauQueryService`
  - DAU is read from the daily aggregate table, with a live fallback for non-aggregated days
  - WAU is computed in SQL from daily activity, avoiding in-memory aggregation in Node.js

- **Scheduled aggregation flow**
  - `DauAggregationScheduler` triggers `DauAggregationService.runOnce()`
  - `Redlock` prevents duplicate concurrent aggregation across instances
  - Daily DAU upsert is performed in set-based SQL instead of row-by-row application loops

## GraphQL Operations

Base URL:

```text
http://localhost:3000/graphql
```

### 1) Ingest Event

```graphql
mutation IngestFeatureUsageEvent($input: IngestFeatureUsageEventInput!) {
  ingestFeatureUsageEvent(input: $input) {
    eventId
    userId
    feature
    occurredAt
    occurredDayUtc
  }
}
```

Variables:

```json
{
  "input": {
    "eventId": "evt_postman_001",
    "userId": "user_mock_123",
    "feature": "message_sent",
    "occurredAt": "2025-11-01T10:00:00Z"
  }
}
```

### 2) Query DAU

```graphql
query DailyActiveUserMetrics($input: FeatureUsageMetricsInput!) {
  dailyActiveUserMetrics(input: $input) {
    companyId
    feature
    activeUsers
    dayUtc
  }
}
```

Variables:

```json
{
  "input": {
    "from": "2025-11-01",
    "to": "2025-11-07",
    "companyId": "company_mock_456",
    "feature": "message_sent"
  }
}
```

### 3) Query WAU

```graphql
query WeeklyActiveUserMetrics($input: FeatureUsageMetricsInput!) {
  weeklyActiveUserMetrics(input: $input) {
    companyId
    feature
    activeUsers
    isoWeek
  }
}
```

### 4) Query Combined Metrics

```graphql
query FeatureUsageMetrics($input: FeatureUsageMetricsInput!) {
  featureUsageMetrics(input: $input) {
    dailyActiveUsers {
      companyId
      feature
      activeUsers
      dayUtc
    }
    weeklyActiveUsers {
      companyId
      feature
      activeUsers
      isoWeek
    }
  }
}
```

## Seeded Data

Default company IDs:

- `company_mock_456`
- `company_mock_789`

Seeded mock user IDs:

- `user_mock_123`
- `user_mock_2`
- `user_mock_3`
- `user_mock_789`

## Logs

Follow app logs:

```bash
docker compose logs -f app
```

If scheduler logs are enabled, you should see periodic aggregation traces in app logs.
