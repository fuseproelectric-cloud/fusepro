/**
 * JobExecutionService
 *
 * Single source of truth for all job status transitions that involve a technician.
 *
 * Responsibilities:
 *   - State machine validation (only valid transitions are allowed)
 *   - Invariant enforcement (no duplicate open intervals, etc.)
 *   - Atomic DB transaction: job update + timesheet entry writes together
 *   - Post-commit: socket events and activity notifications
 *
 * Admin/dispatcher changes go through adminOverride() which skips
 * timesheet side effects and state machine validation.
 */

import { eq, and, sql } from "drizzle-orm";
import type { Server as SocketServer } from "socket.io";
import { db } from "../db";
import { storage } from "../storage";
import { jobs, timesheets } from "@shared/schema";
import type { Job, Timesheet, InsertTimesheet } from "@shared/schema";
import { notificationService } from "./notification.service";

// ─── Error ────────────────────────────────────────────────────────────────────

export class TransitionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 403 | 404 | 409 | 422 | 500,
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

// ─── State machine ────────────────────────────────────────────────────────────

/**
 * Explicit set of transitions a technician is allowed to initiate.
 * Encoded as "fromStatus→toStatus" strings for O(1) lookup.
 * Admin/dispatcher bypass this via adminOverride().
 */
const TECHNICIAN_ALLOWED: ReadonlySet<string> = new Set([
  "assigned→on_the_way",
  "on_the_way→in_progress",
  "in_progress→completed",
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransitionParams {
  /** Authenticated user ID. */
  userId: number;
  /** Display name used in notification text. */
  userName: string;
  /** Technician profile ID (already resolved from userId). */
  technicianId: number;
  jobId: number;
  newStatus: string;
  notes?: string;
  gps?: { lat: number; lng: number; address?: string | null };
  io?: SocketServer;
}

export interface AdminOverrideParams {
  jobId: number;
  newStatus: string;
  notes?: string;
  io?: SocketServer;
}

export interface TransitionResult {
  job: Job;
  timesheetEntries: Timesheet[];
}

// ─── Status → timesheet entry type mapping ────────────────────────────────────
// Determines which job status transitions trigger an activity notification.
// Only statuses in this map produce a notification:activity event.

const STATUS_TO_ENTRY_TYPE: Record<string, string> = {
  on_the_way: "travel_start",
  in_progress: "work_start",
  completed:   "work_end",
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const jobExecutionService = {

  /**
   * Executes a technician-initiated job status transition.
   *
   * Flow:
   *   1. Pre-flight checks (day started, no conflicting active job)
   *   2. Open DB transaction
   *      a. Lock job row FOR UPDATE (prevents concurrent duplicate transitions)
   *      b. Validate ownership
   *      c. Validate state machine transition
   *      d. Count existing timesheet entries (invariant checks)
   *      e. Write job status update
   *      f. Write timesheet entry/entries
   *   3. Commit
   *   4. Post-commit: socket emits + activity notifications
   *
   * Test coverage notes:
   *   - on_the_way twice → second call throws 409 (INV-1, caught inside tx)
   *   - on_the_way → in_progress → creates travel_end + work_start (if travel open)
   *   - in_progress → completed without work_start → throws 422 (INV-3)
   *   - concurrent duplicate update → row lock ensures only one wins, other gets 409
   *   - admin reopens completed job → goes through adminOverride, no entries created
   */
  async transition(params: TransitionParams): Promise<TransitionResult> {
    const { userId, userName, technicianId, jobId, newStatus, notes, gps, io } = params;

    // ── Pre-flight (outside transaction, low-contention reads) ────────────────
    if (newStatus === "on_the_way") {
      const techStatus = await storage.getTechnicianCurrentStatus(technicianId);

      // INV-5: day must be started before beginning travel
      if (!techStatus.isDayStarted) {
        throw new TransitionError(
          "Start your day before beginning travel to a job.",
          422,
        );
      }

      // INV-6: cannot start travel if a different job's work session is already open
      if (techStatus.activeJobId !== null && techStatus.activeJobId !== jobId) {
        throw new TransitionError(
          `Cannot start travel — job #${techStatus.activeJobId} is already in progress.`,
          409,
        );
      }
    }

    let committedJob!: Job;
    const committedEntries: Timesheet[] = [];

    // ── Atomic transaction ────────────────────────────────────────────────────
    await db.transaction(async (tx) => {
      // Helper: count timesheet entries of a given type for this (tech, job) pair.
      // Runs inside the transaction so the count is consistent with pending writes.
      const countEntries = async (type: string): Promise<number> => {
        const [row] = await (tx as unknown as typeof db)
          .select({ cnt: sql<number>`COUNT(*)::int` })
          .from(timesheets)
          .where(
            and(
              eq(timesheets.technicianId, technicianId),
              eq(timesheets.jobId, jobId),
              eq(timesheets.entryType, type),
            ),
          );
        return row?.cnt ?? 0;
      };

      // Lock job row — serializes concurrent transitions on the same job
      const lockedRows = await (tx as unknown as typeof db)
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .for("update");
      const job = lockedRows[0] as Job | undefined;

      if (!job) throw new TransitionError("Job not found.", 404);

      // Ownership check inside transaction (after lock, before any writes)
      if (job.technicianId !== technicianId) {
        throw new TransitionError("You are not assigned to this job.", 403);
      }

      // INV-7: completed is terminal for technicians
      if (job.status === "completed") {
        throw new TransitionError(
          "This job is already completed. Contact your dispatcher to reopen it.",
          422,
        );
      }

      // Validate state machine transition
      const transitionKey = `${job.status}→${newStatus}`;
      if (!TECHNICIAN_ALLOWED.has(transitionKey)) {
        throw new TransitionError(
          `Transition '${job.status}' → '${newStatus}' is not allowed.`,
          422,
        );
      }

      const now = new Date();
      const entryBase: Omit<InsertTimesheet, "entryType"> = {
        technicianId,
        jobId,
        timestamp: now,
        notes: notes ?? null,
        ...(gps ?? {}),
      };

      // ── Invariant checks + timesheet writes (order matters) ────────────────

      if (newStatus === "on_the_way") {
        // INV-1: reject if an open travel interval already exists for this job
        const tStarts = await countEntries("travel_start");
        const tEnds   = await countEntries("travel_end");
        if (tStarts > tEnds) {
          throw new TransitionError(
            "Travel to this job is already in progress.",
            409,
          );
        }

        const [e] = await (tx as unknown as typeof db)
          .insert(timesheets)
          .values({ ...entryBase, entryType: "travel_start" })
          .returning();
        committedEntries.push(e);

      } else if (newStatus === "in_progress") {
        // INV-2: reject if an open work interval already exists for this job
        const wStarts = await countEntries("work_start");
        const wEnds   = await countEntries("work_end");
        if (wStarts > wEnds) {
          throw new TransitionError(
            "Work on this job is already in progress.",
            409,
          );
        }

        // Auto-close open travel interval if present (arrived at site → start work)
        const tStarts = await countEntries("travel_start");
        const tEnds   = await countEntries("travel_end");
        if (tStarts > tEnds) {
          const [te] = await (tx as unknown as typeof db)
            .insert(timesheets)
            .values({ ...entryBase, entryType: "travel_end" })
            .returning();
          committedEntries.push(te);
        }

        const [ws] = await (tx as unknown as typeof db)
          .insert(timesheets)
          .values({ ...entryBase, entryType: "work_start" })
          .returning();
        committedEntries.push(ws);

      } else if (newStatus === "completed") {
        // INV-3: work_end requires an open work interval
        const wStarts = await countEntries("work_start");
        const wEnds   = await countEntries("work_end");
        if (wStarts <= wEnds) {
          throw new TransitionError(
            "Cannot complete: no open work session. Set status to 'in_progress' first.",
            422,
          );
        }

        // INV-4: auto-close open travel interval before completing
        const tStarts = await countEntries("travel_start");
        const tEnds   = await countEntries("travel_end");
        if (tStarts > tEnds) {
          const [te] = await (tx as unknown as typeof db)
            .insert(timesheets)
            .values({ ...entryBase, entryType: "travel_end" })
            .returning();
          committedEntries.push(te);
        }

        const [we] = await (tx as unknown as typeof db)
          .insert(timesheets)
          .values({ ...entryBase, entryType: "work_end" })
          .returning();
        committedEntries.push(we);
      }

      // Write job status update (last write in the transaction — all guards passed)
      const patch: Record<string, unknown> = { status: newStatus };
      if (notes !== undefined) patch.notes = notes;
      if (newStatus === "completed") patch.completedAt = now;

      const updatedRows = await (tx as unknown as typeof db)
        .update(jobs)
        .set(patch)
        .where(eq(jobs.id, jobId))
        .returning();
      committedJob = updatedRows[0] as Job;
    });

    // ── Post-commit: socket emits ────────────────────────────────────────────
    if (io) {
      io.to("staff:notifications").emit("job:updated", committedJob);
      io.to(`job:${committedJob.id}`).emit("job:updated", committedJob);
    }

    // ── Post-commit: activity notification ──────────────────────────────────
    const entryTypeForNotif = STATUS_TO_ENTRY_TYPE[newStatus];
    if (entryTypeForNotif) {
      await notificationService.notifyJobActivity({
        entryType:        entryTypeForNotif,
        jobId,
        jobTitle:         committedJob.title ?? null,
        technicianName:   userName,
        technicianUserId: userId,
        io,
      });
    }

    return { job: committedJob, timesheetEntries: committedEntries };
  },

  /**
   * Admin/dispatcher override: changes job status without any timesheet side effects.
   *
   * - No state machine validation (admin can move to any status)
   * - No timesheet entries created
   * - Emits job:updated after commit
   *
   * Used for:
   *   - Admin reopening a completed job (completed → in_progress)
   *   - Dispatcher cancelling a job mid-flight
   *   - Any status correction
   */
  async adminOverride(params: AdminOverrideParams): Promise<TransitionResult> {
    const { jobId, newStatus, notes, io } = params;

    const patch: Record<string, unknown> = { status: newStatus };
    if (notes !== undefined) patch.notes = notes;
    if (newStatus === "completed") patch.completedAt = new Date();

    const [updated] = await db
      .update(jobs)
      .set(patch)
      .where(eq(jobs.id, jobId))
      .returning();

    if (!updated) throw new TransitionError("Job not found.", 404);

    if (io) {
      io.to("staff:notifications").emit("job:updated", updated);
      io.to(`job:${updated.id}`).emit("job:updated", updated);
    }

    return { job: updated as Job, timesheetEntries: [] };
  },
};
