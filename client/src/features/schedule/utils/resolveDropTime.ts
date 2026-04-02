import type { Job } from "@shared/schema";
import type { DropTarget } from "@/hooks/useJobDragAndDrop";
import { getDateFromPosition } from "@/lib/schedule/timeline-layout";
import { fromCTDayAndMinutes, toCTMinutes } from "@/lib/schedule/ct-time";

/**
 * Determine the new scheduledAt ISO string for a week-view drag.
 *
 * Priority:
 * 1. Drop X position → exact CT time via getDateFromPosition (no local-TZ math)
 * 2. Preserve the existing job time on the new day via fromCTDayAndMinutes
 * 3. Default to 09:00 CT
 */
export function resolveDropTime(job: Job | undefined, target: DropTarget): string {
  if (target.dropOffsetX !== undefined && target.cellWidth !== undefined) {
    return getDateFromPosition(target.dropOffsetX, target.cellWidth, target.dayStr).toISOString();
  }
  const ctMin = job?.scheduledAt ? toCTMinutes(new Date(job.scheduledAt)) : 9 * 60;
  return fromCTDayAndMinutes(target.dayStr, ctMin).toISOString();
}
