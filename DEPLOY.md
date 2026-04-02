# Deployment Guide

## Prerequisites

- Node.js 20+
- PostgreSQL database
- `DATABASE_URL` environment variable set

## Deploy steps

```bash
# 1. Install dependencies
npm install

# 2. Build client + server
npm run build

# 3. Apply database migrations
DATABASE_URL=<your_production_db_url> npm run db:migrate

# 4. Start the server
NODE_ENV=production DATABASE_URL=<your_production_db_url> npm start
```

> **Warning:** The application will fail to start if migrations have not been applied.
> Step 3 must run before step 4 on every deploy that includes new migration files.

## Alternative: single start command

`start:prod` chains migration + server start in one command:

```bash
NODE_ENV=production DATABASE_URL=<your_production_db_url> npm run start:prod
```

This is equivalent to running `db:migrate` then `start` in sequence.
The server will not start if any migration fails.

## How migrations work

- SQL files live in `migrations/` and are numbered `0001_…`, `0002_…`, etc.
- The runner tracks applied migrations in a `_migrations` table.
- Re-running `db:migrate` on a fully migrated database is a no-op (safe).
- On first failure the runner aborts — no partial application.

## Critical migration

`0003_numbering_sequences.sql` creates the PostgreSQL sequences used for
concurrency-safe job and invoice numbering:

- `job_number_seq` → required for `POST /api/jobs`
- `invoice_number_seq` → required for `POST /api/invoices`

If either sequence is missing, the corresponding create endpoint returns HTTP 500.
Running `db:migrate` is the only correct fix.

## Rollback notes

All existing migrations (`0001`–`0006`) use `IF NOT EXISTS` and `ON CONFLICT DO NOTHING`
guards and are safe to apply against a live database without downtime.

Sequences are non-transactional: if a job creation is rolled back after `nextval` is
called, the sequence value is consumed and a gap appears in the number series
(e.g. J-0041, J-0043). This is expected and operationally acceptable.

---

## Health endpoints

### GET /api/health — liveness probe

Always returns `200` while the process is running. No dependency checks.
Use this for process-level health checks (e.g. Docker `HEALTHCHECK`).

```json
{ "status": "ok" }
```

### GET /api/ready — readiness probe

Checks all runtime dependencies and returns a structured report.
Returns `200` when healthy, `503` when any active dependency is degraded or unreachable.
Use this for load-balancer / orchestration readiness gates.

```json
{
  "status": "ok",
  "checks": {
    "db":    { "status": "ok",             "message": "Database reachable", "latencyMs": 4,  "checkedAt": "2025-04-02T..." },
    "redis": { "status": "not_configured", "message": "Redis is not configured in this deployment",            "checkedAt": "2025-04-02T..." },
    "queue": { "status": "ok",             "message": "In-process job queue operational (2 handlers registered)", "checkedAt": "2025-04-02T..." }
  },
  "checkedAt": "2025-04-02T..."
}
```

#### Status values

| Status            | Meaning |
|-------------------|---------|
| `ok`              | Dependency is reachable and working normally |
| `degraded`        | Dependency is reachable but impaired (e.g. queue has no handlers) |
| `error`           | Dependency is unreachable or threw an exception |
| `not_configured`  | Dependency is intentionally absent in this deployment (never a failure) |

#### Overall status roll-up

The top-level `status` reflects the worst state across **active** checks.
`not_configured` dependencies are excluded from the roll-up.

| Top-level status | Condition |
|------------------|-----------|
| `ok`             | All active checks are `ok` |
| `degraded`       | At least one active check is `degraded`, none are `error` |
| `error`          | At least one active check is `error` |

#### Dependency inventory

| Dependency | Type                | Startup-critical | Notes |
|------------|---------------------|------------------|-------|
| `db`       | PostgreSQL (pg pool)| Yes              | `SELECT 1` probe with latency measurement |
| `redis`    | —                   | No               | Not configured; sessions and queue are DB/in-process |
| `queue`    | In-process          | No               | Checks handler registration count |

---

## Background health monitor

The app runs a background health monitor that periodically checks all
dependencies and logs structured alerts on state transitions.

### Behaviour

- Runs an initial check immediately after the server starts listening.
- Then polls every `HEALTHCHECK_INTERVAL_MS` milliseconds (default: 60 000).
- **Only logs on state transitions** — no spam when everything is stable.
- Uses `unref()` so the monitor never prevents graceful process shutdown.

### Alert log events

| Transition                      | Level  | Message |
|---------------------------------|--------|---------|
| First run, dependency unhealthy | `WARN` | `Dependency unhealthy at startup` |
| healthy → unhealthy             | `WARN` | `Dependency health changed` |
| unhealthy → healthy             | `INFO` | `Dependency recovered` |

All alert log lines include structured fields:
`dependency`, `previousStatus`, `status`, `message`

Example:
```
2025-04-02T10:30:00.000Z WARN  Dependency health changed | source=health-monitor dependency=db previousStatus=ok status=error message=connection refused
2025-04-02T10:31:00.000Z INFO  Dependency recovered      | source=health-monitor dependency=db previousStatus=error status=ok message=Database reachable
```

---

## Environment variables

| Variable                       | Default  | Description |
|--------------------------------|----------|-------------|
| `DATABASE_URL`                 | required | PostgreSQL connection string |
| `PORT`                         | `5001`   | HTTP server port |
| `NODE_ENV`                     | —        | Set to `production` for prod builds |
| `SESSION_SECRET`               | required | Express session signing key (min 32 chars) |
| `HEALTHCHECK_INTERVAL_MS`      | `60000`  | Health monitor poll interval in milliseconds |
| `ALERT_ON_HEALTH_TRANSITIONS`  | `true`   | Set to `false` to suppress health transition logs |
