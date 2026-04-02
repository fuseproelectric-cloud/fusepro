import { jobQueue } from "../job-queue";
import {
  NOTIFY_TIMESHEET_ACTIVITY,
  NOTIFY_JOB_ACTIVITY,
  type NotifyTimesheetActivityPayload,
  type NotifyJobActivityPayload,
} from "../job-types";
import { notificationService } from "../../../services/notification.service";

/**
 * Job handlers for notification fan-out.
 *
 * These run outside the request hot path — jobs are scheduled via setImmediate
 * after the domain event handler returns. Failures are caught and logged by
 * the queue; they do not affect the originating request.
 */

jobQueue.register<NotifyTimesheetActivityPayload>(
  NOTIFY_TIMESHEET_ACTIVITY,
  (payload) => notificationService.notifyDayActivity(payload),
);

jobQueue.register<NotifyJobActivityPayload>(
  NOTIFY_JOB_ACTIVITY,
  (payload) => notificationService.notifyJobActivity(payload),
);
