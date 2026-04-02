import type { Server as SocketServer } from "socket.io";
import type { Job } from "@shared/schema";

// ─── Event name ───────────────────────────────────────────────────────────────

export const JOB_STATUS_CHANGED = "job.status_changed";

// ─── Event payload ────────────────────────────────────────────────────────────

/**
 * Published after a job status update is committed to the database.
 * Covers both technician-initiated transitions and admin/dispatcher overrides.
 *
 * Side effects that subscribe to this event:
 *   - Realtime: `job:updated` socket emits (always, when io is present)
 *   - Notification: activity notification (only for technician transitions
 *     where `notificationEntryType` is defined)
 */
export interface JobStatusChanged {
  /** The committed job record with its new status. */
  job: Job;
  /**
   * Timesheet entry type used for activity notification label lookup
   * (e.g. "travel_start" → "is on the way"). Undefined for admin overrides
   * where no activity notification should be created.
   */
  notificationEntryType?: string;
  /** Display name of the technician — required when notificationEntryType is set. */
  technicianName?: string;
  /** User ID of the technician — required when notificationEntryType is set. */
  technicianUserId?: number;
  /** Socket.IO server instance for realtime delivery (optional / best-effort). */
  io?: SocketServer;
}
