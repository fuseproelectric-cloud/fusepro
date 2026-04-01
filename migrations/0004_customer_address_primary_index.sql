-- Migration: 0004_customer_address_primary_index
--
-- Adds a partial unique index to enforce at most one primary address per customer
-- at the database level. This is a safety net for:
--   - data patched outside the application
--   - manual DB operations
--   - any future code path that bypasses CustomerAddressService
--
-- The service itself enforces this invariant transactionally; this index is a
-- last-resort guard and will not fire under normal application operation.
--
-- Idempotent: CREATE UNIQUE INDEX IF NOT EXISTS is safe to run multiple times.

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_one_primary
  ON customer_addresses (customer_id)
  WHERE is_primary = true;
