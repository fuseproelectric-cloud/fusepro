-- Migration: 0001_request_conversion_hardening
-- Purpose: Add request traceability FK to jobs, unique constraint on job_number,
--          and lookup indexes for the Request conversion hardening.
--
-- Safe to run on a live database: all operations use IF NOT EXISTS / IF EXISTS guards.
-- Run before deploying the server build that includes RequestConversionService.

-- 1. Add request_id FK to jobs
--    Nullable: only populated on Request → Job conversions; direct job creation is unaffected.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS request_id INTEGER REFERENCES requests(id);

-- 2. Unique constraint on job_number
--    UNIQUE(job_number) is the active collision guard while global numbering is not
--    yet serialized. A concurrent duplicate will fail here rather than insert silently.
--    Skip if existing data already has duplicates (investigate before applying in that case).
ALTER TABLE jobs
  ADD CONSTRAINT jobs_job_number_unique UNIQUE (job_number);

-- 3. Lookup index: find estimate for a given request
CREATE INDEX IF NOT EXISTS idx_estimates_request_id
  ON estimates(request_id)
  WHERE request_id IS NOT NULL;

-- 4. Lookup index: find job for a given request
CREATE INDEX IF NOT EXISTS idx_jobs_request_id
  ON jobs(request_id)
  WHERE request_id IS NOT NULL;
