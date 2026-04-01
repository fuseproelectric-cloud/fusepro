import type { Job } from "@shared/schema";
import {
  type TechWithUser,
  buildTechColorMap,
  getTechName,
  isJobScheduled,
  isJobUnscheduled,
} from "./job-utils";
import { dateStrCT } from "@/lib/time";

export interface TechBoardRow {
  technicianId: number;
  name: string;
  color: string;
  /** CT date string → jobs for that day */
  days: Record<string, Job[]>;
}

export interface ScheduleBoard {
  /** Per-technician rows, each with jobs grouped by CT date string */
  technicians: TechBoardRow[];
  /** Jobs with no scheduledAt (excluding cancelled) */
  unscheduledJobs: Job[];
}

export interface BuildBoardOptions {
  jobs: Job[];
  technicians: TechWithUser[];
  /** Mon–Sun Date array for the displayed week */
  weekDays: Date[];
  /** "all" or a numeric technician id as string */
  selectedTechId?: string;
}

export function buildScheduleBoard({
  jobs,
  technicians,
  weekDays,
  selectedTechId = "all",
}: BuildBoardOptions): ScheduleBoard {
  const colorMap = buildTechColorMap(technicians);
  const weekDayStrs = weekDays.map(d => dateStrCT(d));

  const activeTechs =
    selectedTechId === "all"
      ? technicians
      : technicians.filter(t => t.id === Number(selectedTechId));

  const scheduledJobs = jobs.filter(isJobScheduled);

  const techRows: TechBoardRow[] = activeTechs.map(tech => {
    const days: Record<string, Job[]> = {};
    for (const dayStr of weekDayStrs) {
      days[dayStr] = scheduledJobs.filter(
        j =>
          j.technicianId === tech.id &&
          dateStrCT(new Date(j.scheduledAt!)) === dayStr
      );
    }
    return {
      technicianId: tech.id,
      name: getTechName(tech),
      color: colorMap.get(tech.id) ?? "#6b7280",
      days,
    };
  });

  // Scheduled jobs with no technician (show in every relevant day, not per-tech)
  const unassignedScheduled = scheduledJobs.filter(j => !j.technicianId);
  if (selectedTechId === "all" && unassignedScheduled.length > 0) {
    const unassignedRow: TechBoardRow = {
      technicianId: 0,
      name: "Unassigned",
      color: "#6b7280",
      days: {},
    };
    for (const dayStr of weekDayStrs) {
      unassignedRow.days[dayStr] = unassignedScheduled.filter(
        j => dateStrCT(new Date(j.scheduledAt!)) === dayStr
      );
    }
    // Only add row if it has any jobs
    if (unassignedScheduled.some(j =>
      weekDayStrs.includes(dateStrCT(new Date(j.scheduledAt!)))
    )) {
      techRows.push(unassignedRow);
    }
  }

  return {
    technicians: techRows,
    unscheduledJobs: jobs.filter(isJobUnscheduled),
  };
}

/**
 * Flatten board across all tech rows to get all jobs for a given day.
 * Used by the current flat-grid view.
 */
export function getJobsForDay(board: ScheduleBoard, dayStr: string): Job[] {
  return board.technicians.flatMap(row => row.days[dayStr] ?? []);
}
