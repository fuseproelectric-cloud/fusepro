import type { Server as SocketServer } from "socket.io";

// ─── Job type constants ───────────────────────────────────────────────────────

/** Persists an activity notification for a day/break timesheet entry. */
export const NOTIFY_TIMESHEET_ACTIVITY = "notify_timesheet_activity";

/** Persists an activity notification for a job status transition. */
export const NOTIFY_JOB_ACTIVITY = "notify_job_activity";

// ─── Payload interfaces ───────────────────────────────────────────────────────

export interface NotifyTimesheetActivityPayload {
  entryType: string;
  user:      { id: number; name: string };
  timestamp: Date;
  notes?:    string | null;
  io?:       SocketServer;
}

export interface NotifyJobActivityPayload {
  entryType:        string;
  jobId:            number;
  jobTitle:         string | null;
  technicianName:   string;
  technicianUserId: number;
  io?:              SocketServer;
}
