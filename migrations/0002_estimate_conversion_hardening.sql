-- Migration: 0002_estimate_conversion_hardening
-- Purpose: Add unique constraint on invoices.estimate_id (one invoice per estimate),
--          unique constraint on invoices.invoice_number (collision safety net),
--          and lookup index for estimate → invoice traceability.
--
-- !! REQUIRED PRECHECK BEFORE RUNNING !!
-- Check for existing duplicate estimate_id values (created via old UI-driven flow):
--
--   SELECT estimate_id, COUNT(*) AS cnt
--   FROM invoices
--   WHERE estimate_id IS NOT NULL
--   GROUP BY estimate_id
--   HAVING COUNT(*) > 1;
--
-- If any rows are returned, resolve duplicates manually before applying this migration.
-- Typically: retain the most recent invoice per estimate and delete or re-link others.
--
-- Check for existing duplicate invoice_number values:
--
--   SELECT invoice_number, COUNT(*) AS cnt
--   FROM invoices
--   WHERE invoice_number IS NOT NULL
--   GROUP BY invoice_number
--   HAVING COUNT(*) > 1;
--
-- Safe to run on a live database once prechecks pass.
-- All operations use IF NOT EXISTS / conditional guards where supported.

-- 1. Unique constraint: one invoice per estimate (NULL = standalone invoice, always allowed)
ALTER TABLE invoices
  ADD CONSTRAINT invoices_estimate_id_unique UNIQUE (estimate_id);

-- 2. Unique constraint on invoice_number (safety net for concurrent number generation)
ALTER TABLE invoices
  ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);

-- 3. Lookup index: find invoice for a given estimate (partial: only non-null estimate_id rows)
CREATE INDEX IF NOT EXISTS idx_invoices_estimate_id
  ON invoices(estimate_id)
  WHERE estimate_id IS NOT NULL;
