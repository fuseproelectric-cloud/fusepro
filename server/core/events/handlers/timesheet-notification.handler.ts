import { domainEventBus } from "../domain-event-bus";
import { TIMESHEET_ENTRY_CREATED, type TimesheetEntryCreated } from "../timesheet.events";
import { jobQueue } from "../../queue/job-queue";
import { NOTIFY_TIMESHEET_ACTIVITY } from "../../queue/job-types";

/**
 * Handles the TimesheetEntryCreated event.
 *
 * Side effects are enqueued as background jobs so notification fan-out
 * (DB writes + socket emit) runs outside the request hot path.
 *
 * The timestamp is serialized to an ISO string at enqueue time — BullMQ
 * stores payloads as JSON and Date objects are not safely round-tripped.
 */
export function handleTimesheetEntryCreated(event: TimesheetEntryCreated): void {
  jobQueue.enqueue(NOTIFY_TIMESHEET_ACTIVITY, {
    entryType: event.entryType,
    user:      event.user,
    timestamp: event.timestamp instanceof Date
      ? event.timestamp.toISOString()
      : String(event.timestamp),
    notes:     event.notes ?? null,
  });
}

domainEventBus.on(TIMESHEET_ENTRY_CREATED, handleTimesheetEntryCreated);
