import { useMemo } from "react";
import type { ScheduleBoard } from "@/lib/schedule/board-builder";
import { computeJobLayouts, ROW_HEIGHT_PX, type JobWithLayout } from "@/lib/schedule/timeline-utils";
import { dateStrCT } from "@/lib/time";

export interface TechTimelineRow {
  technicianId: number;
  name:         string;
  color:        string;
  jobs:         JobWithLayout[];
}

/**
 * Derives per-technician timeline rows for a single day.
 * Re-computes only when the board data or selected day changes.
 */
export function useTimelineLayout(
  board: ScheduleBoard,
  selectedDay: Date
): TechTimelineRow[] {
  const dayStr = dateStrCT(selectedDay);

  return useMemo(
    () =>
      board.technicians.map(row => ({
        technicianId: row.technicianId,
        name:         row.name,
        color:        row.color,
        jobs:         computeJobLayouts(row.days[dayStr] ?? [], ROW_HEIGHT_PX),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board.technicians, dayStr]
  );
}
