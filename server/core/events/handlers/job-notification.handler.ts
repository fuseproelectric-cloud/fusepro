import { domainEventBus } from "../domain-event-bus";
import { JOB_STATUS_CHANGED, type JobStatusChanged } from "../job.events";
import { notificationService } from "../../../services/notification.service";

/**
 * Handles the JobStatusChanged event.
 *
 * Side effects:
 *   1. Realtime: emits `job:updated` to staff:notifications and job:{id} rooms
 *      (always, when io is present — applies to both technician transitions
 *      and admin/dispatcher overrides)
 *   2. Notification: persists an activity notification per admin/dispatcher
 *      recipient and emits `notification:activity` (only for technician
 *      transitions where notificationEntryType is defined)
 */
export async function handleJobStatusChanged(event: JobStatusChanged): Promise<void> {
  const { job, notificationEntryType, technicianName, technicianUserId, io } = event;

  // ── Realtime: always broadcast the updated job record ─────────────────────
  if (io) {
    io.to("staff:notifications").emit("job:updated", job);
    io.to(`job:${job.id}`).emit("job:updated", job);
  }

  // ── Activity notification: only for technician-initiated transitions ───────
  if (
    notificationEntryType !== undefined &&
    technicianName !== undefined &&
    technicianUserId !== undefined
  ) {
    await notificationService.notifyJobActivity({
      entryType:        notificationEntryType,
      jobId:            job.id,
      jobTitle:         job.title ?? null,
      technicianName,
      technicianUserId,
      io,
    });
  }
}

domainEventBus.on(JOB_STATUS_CHANGED, handleJobStatusChanged);
