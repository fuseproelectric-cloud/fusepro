/**
 * TimesheetService
 *
 * Owns day-lifecycle and break entries only:
 *   day_start | day_end | break_start | break_end
 *
 * Job-lifecycle entries (travel_start, travel_end, work_start, work_end)
 * are NOT handled here — they are created exclusively by JobExecutionService
 * as a side effect of PUT /api/jobs/:id/status transitions.
 *
 * Each method:
 *  1. Opens a transaction and acquires a SELECT FOR UPDATE lock on the
 *     technician row, serializing concurrent calls for the same technician.
 *  2. Re-reads current state inside the lock (reads committed data after lock).
 *  3. Validates the business invariant.
 *  4. Inserts the new entry with a server-generated timestamp (client value ignored).
 *  5. Commits.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { timesheetsRepository } from "../modules/timesheets/timesheets.repository";
import { timesheets, technicians } from "@shared/schema";
import type { Timesheet, InsertTimesheet } from "@shared/schema";
import { AppError } from "../core/errors/app-error";

// ─── Error ────────────────────────────────────────────────────────────────────

export class TimesheetValidationError extends AppError {
  constructor(
    message: string,
    public readonly statusCode: 409 | 422,
  ) {
    super(message, statusCode, statusCode === 409 ? "TIMESHEET_CONFLICT" : "TIMESHEET_INVALID");
    this.name = "TimesheetValidationError";
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Entry types that belong to job execution lifecycle.
 * POST /api/timesheet rejects these — they must go through
 * PUT /api/jobs/:id/status (handled by JobExecutionService).
 */
export const JOB_LIFECYCLE_ENTRY_TYPES: ReadonlySet<string> = new Set([
  "travel_start",
  "travel_end",
  "work_start",
  "work_end",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Acquires a SELECT FOR UPDATE lock on the technician row inside an active
 * transaction. Throws TimesheetValidationError (422) if the technician does
 * not exist. Returns once the lock is held; subsequent reads in the same
 * connection will see a consistent locked view.
 */
async function lockTechnician(
  tx: typeof db,
  technicianId: number,
): Promise<void> {
  const rows = await tx
    .select({ id: technicians.id })
    .from(technicians)
    .where(eq(technicians.id, technicianId))
    .for("update");
  if (rows.length === 0) {
    throw new TimesheetValidationError("Technician not found.", 422);
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const timesheetService = {

  /**
   * Records that a technician has started their working day.
   * Rejects if a day is already active (prevents double day_start).
   * Timestamp is always server-generated; any client-provided value is ignored.
   */
  async startDay(data: InsertTimesheet): Promise<Timesheet> {
    let result: Timesheet | undefined;
    await db.transaction(async (tx) => {
      await lockTechnician(tx as unknown as typeof db, data.technicianId);
      // State read happens after lock is acquired — guaranteed to see committed state
      const status = await timesheetsRepository.getCurrentStatus(data.technicianId);
      if (status.isDayStarted) {
        throw new TimesheetValidationError("Day is already started.", 409);
      }
      const [entry] = await (tx as unknown as typeof db)
        .insert(timesheets)
        .values({ ...data, timestamp: new Date() })
        .returning();
      result = entry;
    });
    return result!;
  },

  /**
   * Records that a technician has ended their working day.
   * Rejects if no active day, if a break is active, or if a job is in progress.
   */
  async endDay(data: InsertTimesheet): Promise<Timesheet> {
    let result: Timesheet | undefined;
    await db.transaction(async (tx) => {
      await lockTechnician(tx as unknown as typeof db, data.technicianId);
      const status = await timesheetsRepository.getCurrentStatus(data.technicianId);
      if (!status.isDayStarted) {
        throw new TimesheetValidationError("No active day to end.", 409);
      }
      // Cannot end the day while on break — end the break first
      if (status.isOnBreak) {
        throw new TimesheetValidationError(
          "Cannot end your day while on break. End the break first.",
          422,
        );
      }
      // Cannot end the day while a job is still open
      if (status.activeJobId !== null) {
        throw new TimesheetValidationError(
          "Cannot end your day while a job is in progress. Complete or hand off the job first.",
          422,
        );
      }
      const [entry] = await (tx as unknown as typeof db)
        .insert(timesheets)
        .values({ ...data, timestamp: new Date() })
        .returning();
      result = entry;
    });
    return result!;
  },

  /**
   * Records the start of a break.
   * Requires an active day. Rejects if already on break or if a job is in progress.
   * A break taken during an open work interval would inflate paid work time — block it.
   */
  async startBreak(data: InsertTimesheet): Promise<Timesheet> {
    let result: Timesheet | undefined;
    await db.transaction(async (tx) => {
      await lockTechnician(tx as unknown as typeof db, data.technicianId);
      const status = await timesheetsRepository.getCurrentStatus(data.technicianId);
      if (!status.isDayStarted) {
        throw new TimesheetValidationError("Start your day before taking a break.", 422);
      }
      if (status.isOnBreak) {
        throw new TimesheetValidationError("Already on break.", 409);
      }
      if (status.activeJobId !== null) {
        throw new TimesheetValidationError(
          "Cannot take a break while a job is in progress. Complete or hand off the job first.",
          422,
        );
      }
      const [entry] = await (tx as unknown as typeof db)
        .insert(timesheets)
        .values({ ...data, timestamp: new Date() })
        .returning();
      result = entry;
    });
    return result!;
  },

  /**
   * Records the end of a break.
   * Rejects if no active break exists.
   */
  async endBreak(data: InsertTimesheet): Promise<Timesheet> {
    let result: Timesheet | undefined;
    await db.transaction(async (tx) => {
      await lockTechnician(tx as unknown as typeof db, data.technicianId);
      const status = await timesheetsRepository.getCurrentStatus(data.technicianId);
      if (!status.isOnBreak) {
        throw new TimesheetValidationError("No active break to end.", 409);
      }
      const [entry] = await (tx as unknown as typeof db)
        .insert(timesheets)
        .values({ ...data, timestamp: new Date() })
        .returning();
      result = entry;
    });
    return result!;
  },
};
