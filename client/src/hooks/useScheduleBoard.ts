import { useState, useMemo } from "react";
import { startOfWeek } from "date-fns";
import type { Job } from "@shared/schema";
import type { TechWithUser } from "@/lib/schedule/job-utils";
import { buildScheduleBoard, getJobsForDay, type ScheduleBoard } from "@/lib/schedule/board-builder";
import { getDaysOfWeek, getWeekRange, shiftWeek, dateStrCT } from "@/lib/schedule/date-utils";
import { todayStrCT } from "@/lib/time";

export interface ScheduleBoardFilters {
  selectedTechId: string;
}

export interface UseScheduleBoardReturn {
  // Week state
  weekStart: Date;
  weekEnd: Date;
  weekDays: Date[];
  todayCT: string;

  // Navigation
  prevWeek: () => void;
  nextWeek: () => void;
  goToToday: () => void;

  // Board
  board: ScheduleBoard;

  // Convenience helpers
  getJobsForDay: (day: Date) => Job[];
  unscheduledJobs: Job[];
}

export function useScheduleBoard(
  jobs: Job[],
  technicians: TechWithUser[],
  filters: ScheduleBoardFilters
): UseScheduleBoardReturn {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekDays = useMemo(() => getDaysOfWeek(weekStart), [weekStart]);
  const { end: weekEnd } = useMemo(() => getWeekRange(weekStart), [weekStart]);

  const board = useMemo(
    () =>
      buildScheduleBoard({
        jobs,
        technicians,
        weekDays,
        selectedTechId: filters.selectedTechId,
      }),
    [jobs, technicians, weekDays, filters.selectedTechId]
  );

  return {
    weekStart,
    weekEnd,
    weekDays,
    todayCT: todayStrCT(),

    prevWeek: () => setWeekStart(d => shiftWeek(d, -1)),
    nextWeek: () => setWeekStart(d => shiftWeek(d, 1)),
    goToToday: () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })),

    board,
    getJobsForDay: (day: Date) => getJobsForDay(board, dateStrCT(day)),
    unscheduledJobs: board.unscheduledJobs,
  };
}
