-- Audit log table.
--
-- Records important business mutations so production issues can be diagnosed
-- and a basic paper trail is maintained for who changed what and when.
--
-- Design notes:
--   - request_id links a row back to an HTTP request's X-Request-ID header.
--   - performed_by_user_id is nullable; system-initiated actions have no user.
--   - entity_id is nullable for entity-agnostic actions (e.g. bulk settings update).
--   - metadata is unstructured JSON for action-specific context (status changes,
--     conversion source/target, etc.) — avoids premature schema rigidity.
--   - No foreign-key index on entity_id because it references multiple tables
--     depending on entity_type; partial queries by (entity_type, entity_id) use
--     idx_audit_logs_entity.

CREATE TABLE IF NOT EXISTS audit_logs (
  id                    SERIAL PRIMARY KEY,
  request_id            TEXT,
  performed_by_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action                VARCHAR(100) NOT NULL,
  entity_type           VARCHAR(100) NOT NULL,
  entity_id             INTEGER,
  metadata              JSON,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user       ON audit_logs(performed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
