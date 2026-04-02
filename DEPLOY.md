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
