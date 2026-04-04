import { domainEventBus } from "../domain-event-bus";
import { JOB_STATUS_CHANGED, type JobStatusChanged } from "../job.events";
import { jobQueue } from "../../queue/job-queue";
import { NOTIFY_JOB_ACTIVITY } from "../../queue/job-types";
import { getSocketServer } from "../../realtime/socket-registry";

/**
 * Handles the JobStatusChanged event.
 *
 * Side effects:
 *   1. Realtime: emits `job:updated` to staff:notifications and job:{id} rooms
 *      synchronously — keeps clients in sync immediately after a status change.
 *      The Socket.IO instance is resolved from the socket registry (not passed
 *      through the event payload) so the payload is JSON-serializable.
 *   2. Notification: enqueues activity notification fan-out as a background job
 *      (only for technician transitions where notificationEntryType is defined).
 */
export function handleJobStatusChanged(event: JobStatusChanged): void {
  const { job, notificationEntryType, technicianName, technicianUserId } = event;

  // ── Realtime: always broadcast the updated job record ─────────────────────
  const io = getSocketServer();
  if (io) {
    io.to("staff:notifications").emit("job:updated", job);
    io.to(`job:${job.id}`).emit("job:updated", job);
  }

  // ── Activity notification: enqueue for async fan-out ──────────────────────
  if (
    notificationEntryType !== undefined &&
    technicianName !== undefined &&
    technicianUserId !== undefined
  ) {
    jobQueue.enqueue(NOTIFY_JOB_ACTIVITY, {
      entryType:        notificationEntryType,
      jobId:            job.id,
      jobTitle:         job.title ?? null,
      technicianName,
      technicianUserId,
    });
  }
}

domainEventBus.on(JOB_STATUS_CHANGED, handleJobStatusChanged);
