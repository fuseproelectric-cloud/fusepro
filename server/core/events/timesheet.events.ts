import type { Server as SocketServer } from "socket.io";

// ─── Event name ───────────────────────────────────────────────────────────────

export const TIMESHEET_ENTRY_CREATED = "timesheet.entry_created";

// ─── Event payload ────────────────────────────────────────────────────────────

/**
 * Published after a day-lifecycle or break timesheet entry is successfully
 * committed to the database (day_start | day_end | break_start | break_end).
 *
 * Job-lifecycle entries (travel_start/end, work_start/end) are published as
 * part of JobStatusChanged — not here.
 */
export interface TimesheetEntryCreated {
  /** Entry type: day_start | day_end | break_start | break_end */
  entryType: string;
  /** The technician user who created the entry. */
  user: { id: number; name: string };
  /** Server-generated timestamp of the entry. */
  timestamp: Date;
  /** Optional notes attached to the entry. */
  notes?: string | null;
  /** Socket.IO server instance for realtime delivery (optional / best-effort). */
  io?: SocketServer;
}
