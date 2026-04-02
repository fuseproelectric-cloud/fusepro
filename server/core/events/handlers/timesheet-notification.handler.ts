import { domainEventBus } from "../domain-event-bus";
import { TIMESHEET_ENTRY_CREATED, type TimesheetEntryCreated } from "../timesheet.events";
import { notificationService } from "../../../services/notification.service";

/**
 * Handles the TimesheetEntryCreated event.
 *
 * Side effects:
 *   - Persists an activity notification row per admin/dispatcher recipient
 *   - Emits `notification:activity` → staff:notifications (if io present)
 */
export async function handleTimesheetEntryCreated(event: TimesheetEntryCreated): Promise<void> {
  await notificationService.notifyDayActivity({
    entryType: event.entryType,
    user:      event.user,
    timestamp: event.timestamp,
    notes:     event.notes ?? null,
    io:        event.io,
  });
}

domainEventBus.on(TIMESHEET_ENTRY_CREATED, handleTimesheetEntryCreated);
