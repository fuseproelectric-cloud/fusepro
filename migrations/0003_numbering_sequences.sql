-- Migration: 0003_numbering_sequences
--
-- Creates PostgreSQL sequences for concurrency-safe job and invoice numbering.
-- Each sequence is initialized from the current MAX() of the corresponding
-- column so that no existing numbers are re-used after the migration runs.
--
-- Both CREATE SEQUENCE calls are guarded with IF NOT EXISTS so the migration
-- is safe to run multiple times (idempotent).

DO $$
DECLARE
  max_job_num INTEGER;
  max_inv_num INTEGER;
BEGIN
  -- ── job_number_seq ────────────────────────────────────────────────────────
  SELECT COALESCE(
    MAX(CAST(REGEXP_REPLACE(job_number, '[^0-9]', '', 'g') AS INTEGER)), 0
  )
  INTO max_job_num
  FROM jobs
  WHERE job_number IS NOT NULL AND job_number ~ '^J-[0-9]+';

  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'job_number_seq') THEN
    EXECUTE format(
      'CREATE SEQUENCE job_number_seq START WITH %s',
      GREATEST(max_job_num + 1, 1)
    );
  END IF;

  -- ── invoice_number_seq ────────────────────────────────────────────────────
  SELECT COALESCE(
    MAX(CAST(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g') AS INTEGER)), 0
  )
  INTO max_inv_num
  FROM invoices
  WHERE invoice_number IS NOT NULL AND invoice_number ~ '^INV-[0-9]+';

  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'invoice_number_seq') THEN
    EXECUTE format(
      'CREATE SEQUENCE invoice_number_seq START WITH %s',
      GREATEST(max_inv_num + 1, 1)
    );
  END IF;
END;
$$;
