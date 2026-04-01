-- Migration: 0006_request_intake_refactor
-- Purpose: Expand requests table to support intake + triage architecture.
--          Adds ownership, contact info, scheduling preferences, priority,
--          richer source/status vocabulary, and conversion tracking fields.
--          Renames 'notes' → 'client_notes' for clarity.
--
-- Safe to run on a live database: all operations use IF NOT EXISTS / IF EXISTS guards.
-- Run before deploying the server build that references the updated schema.

-- 1. Rename notes → client_notes
--    Existing values are preserved.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requests' AND column_name = 'notes'
  ) THEN
    ALTER TABLE requests RENAME COLUMN notes TO client_notes;
  END IF;
END $$;

-- 2. Core intake fields
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS service_address_id INTEGER REFERENCES customer_addresses(id),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(50) NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- 3. Ownership
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id);

-- 4. Contact info at intake
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS customer_contact_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS preferred_contact_method VARCHAR(50);

-- 5. Scheduling preferences
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS requested_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS requested_time_window VARCHAR(100),
  ADD COLUMN IF NOT EXISTS is_flexible_schedule BOOLEAN NOT NULL DEFAULT FALSE;

-- 6. Conversion tracking (written only by RequestConversionService)
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS converted_to_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS converted_by_user_id INTEGER REFERENCES users(id);

-- 7. Performance indexes
CREATE INDEX IF NOT EXISTS idx_requests_owner_user_id ON requests(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
