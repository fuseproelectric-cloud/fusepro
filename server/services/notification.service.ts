/**
 * NotificationService
 *
 * Single owner of all notification creation logic.
 *
 * ── Separation of concerns ────────────────────────────────────────────────────
 * This service encapsulates two distinct concerns that previously lived
 * side-by-side in route handlers and business services:
 *
 *   1. Persistent notifications — unread/read records stored in the DB,
 *      user-owned, queryable, and driven by the `notifications` table.
 *   2. Realtime delivery — Socket.IO emits for live UI updates.
 *
 * These are not the same thing. DB persistence is the source of truth.
 * Socket delivery is best-effort transport; a missed emit never creates a
 * missing notification.
 *
 * ── What this service owns ────────────────────────────────────────────────────
 *   notifyJobNote()     — job note created (message notification)
 *   notifyJobActivity() — job status transition (activity notification)
 *   notifyDayActivity() — day/break timesheet entry (activity notification)
 *
 * ── What this service does NOT own ───────────────────────────────────────────
 *   - notification read/unread routes (HTTP CRUD, routes.ts)
 *   - notification schema (shared/schema.ts)
 *   - low-level DB accessors (storage.ts: getUnreadNotifications, markNotificationRead, etc.)
 */

import type { Server as SocketServer } from "socket.io";
import { jobsRepository } from "../modules/jobs/jobs.repository";
import { notificationsRepository } from "../modules/notifications/notifications.repository";
import { techniciansRepository } from "../modules/technicians/technicians.repository";
import { usersRepository } from "../modules/users/users.repository";

// ─── Label maps (canonical, single definition) ────────────────────────────────

/**
 * Maps timesheet entry types to their human-readable notification label.
 * Used in activity notification `.text` column and socket payloads.
 *
 * Exported so job-execution.service can determine which statuses should
 * generate an activity notification without re-defining the map.
 */
export const ACTIVITY_ENTRY_LABEL: Record<string, string> = {
  travel_start: "is on the way",
  travel_end:   "arrived",
  work_start:   "started working",
  work_end:     "completed work",
  day_start:    "started their day",
  day_end:      "ended their day",
  break_start:  "started a break",
  break_end:    "returned from break",
};

// ─── Parameter interfaces ─────────────────────────────────────────────────────

export interface NotifyJobNoteParams {
  jobId: number;
  noteId: number;
  content: string;
  /** The user who created the note — excluded from recipient list. */
  sender: { id: number; name: string } | null | undefined;
  io?: SocketServer;
}

export interface NotifyJobActivityParams {
  /** Timesheet entry type that triggered this notification (e.g. "travel_start"). */
  entryType: string;
  jobId: number;
  jobTitle: string | null;
  technicianName: string;
  technicianUserId: number;
  io?: SocketServer;
}

export interface NotifyDayActivityParams {
  /** Timesheet entry type: day_start | day_end | break_start | break_end */
  entryType: string;
  user: { id: number; name: string };
  /** ISO string or Date — normalized to Date before DB write. */
  timestamp: Date | string;
  notes?: string | null;
  io?: SocketServer;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const notificationService = {

  /**
   * Handles notifications for a newly created job note.
   *
   * Recipients: all admin + dispatcher users, plus the job's assigned technician
   *             (if any), minus the note author.
   *
   * DB persistence:
   *   One `message` notification row per (recipient, jobId), upserted — multiple
   *   notes on the same job increment `messageCount` rather than creating new rows.
   *   This keeps the unread badge count meaningful without flooding the table.
   *
   * Realtime delivery:
   *   - `notification:new_message` → staff:notifications (admin/dispatcher)
   *   - `notification:new_message` → user:{technicianUserId} (assigned technician)
   */
  async notifyJobNote({ jobId, noteId, content, sender, io }: NotifyJobNoteParams): Promise<void> {
    const senderId = sender?.id ?? null;
    const senderName = sender?.name ?? "Unknown";

    // Resolve job and assigned technician
    const job = await jobsRepository.getById(jobId);
    const jobTitle = job?.title ?? `Job #${jobId}`;

    let technicianUserId: number | null = null;
    if (job?.technicianId) {
      const assignedTech = await techniciansRepository.getById(job.technicianId);
      technicianUserId = assignedTech?.userId ?? null;
    }

    const messagePreview = content.slice(0, 80) || "New message";
    const timestamp = new Date();

    // ── Realtime delivery ──────────────────────────────────────────────────────
    if (io) {
      const socketPayload = {
        jobId,
        noteId,
        fromUserId: senderId,
        fromName:   senderName,
        jobTitle,
        messagePreview,
        timestamp,
        technicianUserId,
      };
      // Staff (admin/dispatcher) via their shared room
      io.to("staff:notifications").emit("notification:new_message", socketPayload);
      // Assigned technician via their personal room (not in staff:notifications)
      if (technicianUserId && technicianUserId !== senderId) {
        io.to(`user:${technicianUserId}`).emit("notification:new_message", socketPayload);
      }
    }

    // ── DB persistence ─────────────────────────────────────────────────────────
    const recipientIds = await usersRepository.getAdminAndDispatcherUserIds();
    if (technicianUserId && !recipientIds.includes(technicianUserId)) {
      recipientIds.push(technicianUserId);
    }

    await Promise.all(
      recipientIds
        .filter((uid: number) => uid !== senderId)
        .map((uid: number) =>
          notificationsRepository.upsertMessage(uid, jobId, {
            fromName:  senderName,
            jobTitle,
            text:      messagePreview,
            timestamp,
          }),
        ),
    );
  },

  /**
   * Handles notifications for a job status transition made by a technician.
   * Called post-commit by JobExecutionService.
   *
   * Recipients: all admin + dispatcher users.
   *
   * DB persistence: one new `activity` row per recipient (not upserted —
   * each transition is a distinct event worth preserving).
   *
   * Realtime delivery:
   *   - `notification:activity` → staff:notifications
   */
  async notifyJobActivity({
    entryType,
    jobId,
    jobTitle,
    technicianName,
    technicianUserId,
    io,
  }: NotifyJobActivityParams): Promise<void> {
    const label   = ACTIVITY_ENTRY_LABEL[entryType] ?? entryType.replace(/_/g, " ");
    const jobPart = jobTitle ? ` — ${jobTitle}` : "";
    const timestamp = new Date();

    // ── Realtime delivery ──────────────────────────────────────────────────────
    if (io) {
      io.to("staff:notifications").emit("notification:activity", {
        entryType,
        technicianName,
        technicianUserId,
        jobId,
        jobTitle,
        timestamp,
        notes: null,
      });
    }

    // ── DB persistence ─────────────────────────────────────────────────────────
    const adminIds = await usersRepository.getAdminAndDispatcherUserIds();
    await Promise.all(
      adminIds.map((uid: number) =>
        notificationsRepository.createActivity(uid, {
          fromName:  technicianName,
          jobId,
          jobTitle,
          text:      `${label}${jobPart}`,
          timestamp,
          entryType,
        }),
      ),
    );
  },

  /**
   * Handles notifications for a day/break timesheet entry.
   * Called post-commit from the timesheet route.
   *
   * Recipients: all admin + dispatcher users.
   * No notification is sent to the technician themselves.
   *
   * DB persistence: one new `activity` row per recipient.
   *
   * Realtime delivery:
   *   - `notification:activity` → staff:notifications
   */
  async notifyDayActivity({
    entryType,
    user,
    timestamp,
    notes,
    io,
  }: NotifyDayActivityParams): Promise<void> {
    const label     = ACTIVITY_ENTRY_LABEL[entryType] ?? entryType.replace(/_/g, " ");
    const ts        = timestamp instanceof Date ? timestamp : new Date(timestamp);

    // ── Realtime delivery ──────────────────────────────────────────────────────
    if (io) {
      io.to("staff:notifications").emit("notification:activity", {
        entryType,
        technicianName:   user.name,
        technicianUserId: user.id,
        jobId:     null,
        jobTitle:  null,
        timestamp: ts,
        notes:     notes ?? null,
      });
    }

    // ── DB persistence ─────────────────────────────────────────────────────────
    const adminIds = await usersRepository.getAdminAndDispatcherUserIds();
    await Promise.all(
      adminIds.map((uid: number) =>
        notificationsRepository.createActivity(uid, {
          fromName:  user.name,
          jobId:     null,
          jobTitle:  null,
          text:      label,
          timestamp: ts,
          entryType,
        }),
      ),
    );
  },
};
