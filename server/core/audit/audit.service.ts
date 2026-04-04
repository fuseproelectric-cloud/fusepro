/**
 * Audit log service.
 *
 * Records important business mutations for production observability and
 * accountability. The primary questions it answers are:
 *   - who performed the action
 *   - what happened (action)
 *   - on which entity
 *   - when
 *   - with what high-level context (metadata)
 *
 * ── Design principles ─────────────────────────────────────────────────────────
 * 1. Fire-and-forget: record() never throws, never rejects, never blocks the
 *    caller. An audit log failure must never affect business operation outcomes.
 *
 * 2. Minimal interface: no field-level diff tracking; metadata is an open object
 *    for action-specific context only.
 *
 * 3. Actions use dot-notation verbs for easy filtering in log aggregators:
 *      "job.status_changed"              "job.status_overridden"
 *      "job.created"                     "job.deleted"
 *      "request.converted_to_estimate"   "request.converted_to_job"
 *      "estimate.converted_to_invoice"
 */

import { db } from "../../db";
import { auditLogs } from "@shared/schema";
import { logger } from "../utils/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  /** HTTP request correlation ID from X-Request-ID / req.requestId. */
  requestId?: string;
  /** Authenticated user who performed the action; omit for system actions. */
  performedByUserId?: number;
  /**
   * Dot-notation action verb.
   * Convention: "<entity>.<verb>" e.g. "job.status_changed", "request.converted_to_estimate"
   */
  action: string;
  /** Domain noun identifying the table/resource. e.g. "job", "request", "invoice" */
  entityType: string;
  /** Primary key of the affected row. Nullable for non-entity-specific actions. */
  entityId?: number;
  /** Action-specific context (status transitions, source/target IDs, etc.). */
  metadata?: Record<string, unknown>;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const auditLog = {
  /**
   * Write an audit log entry.
   *
   * Returns immediately — the DB write is async and errors are swallowed.
   * Callers must never await this or depend on it succeeding.
   */
  record(entry: AuditEntry): void {
    try {
      void db
        .insert(auditLogs)
        .values({
          requestId:          entry.requestId          ?? null,
          performedByUserId:  entry.performedByUserId  ?? null,
          action:             entry.action,
          entityType:         entry.entityType,
          entityId:           entry.entityId           ?? null,
          metadata:           entry.metadata           ?? null,
        })
        .catch(err => {
          logger.error("Audit log write failed", {
            source:      "audit",
            action:      entry.action,
            entity_type: entry.entityType,
            entity_id:   entry.entityId,
            message:     err instanceof Error ? err.message : String(err),
          });
        });
    } catch (err) {
      // Catches synchronous errors (e.g. db not connected, mocked in tests).
      logger.error("Audit log write failed (sync)", {
        source:      "audit",
        action:      entry.action,
        entity_type: entry.entityType,
        entity_id:   entry.entityId,
        message:     err instanceof Error ? err.message : String(err),
      });
    }
  },
};
