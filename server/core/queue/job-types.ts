// ─── Job type constants ───────────────────────────────────────────────────────

/** Persists an activity notification for a day/break timesheet entry. */
export const NOTIFY_TIMESHEET_ACTIVITY = "notify_timesheet_activity";

/** Persists an activity notification for a job status transition. */
export const NOTIFY_JOB_ACTIVITY = "notify_job_activity";

// ─── Payload interfaces ───────────────────────────────────────────────────────
//
// All payload fields must be JSON-serializable — no class instances, functions,
// or Socket.IO server references. BullMQ stores these in Redis as JSON strings.
//
// Socket.IO delivery for realtime updates is handled by the notification service
// via the getSocketServer() registry, not via payload injection.

export interface NotifyTimesheetActivityPayload {
  entryType: string;
  user:      { id: number; name: string };
  /** ISO 8601 string — serialized from Date at enqueue time. */
  timestamp: string;
  notes?:    string | null;
}

export interface NotifyJobActivityPayload {
  entryType:        string;
  jobId:            number;
  jobTitle:         string | null;
  technicianName:   string;
  technicianUserId: number;
}
