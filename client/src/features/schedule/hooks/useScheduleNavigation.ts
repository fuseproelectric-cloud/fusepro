import { useState } from "react";
import { addDays } from "date-fns";
import type { ViewMode } from "@/components/schedule/ScheduleToolbar";

export interface ScheduleNavigationResult {
  selectedTechId: string;
  setSelectedTechId: (id: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedDay: Date;
  prevDay: () => void;
  nextDay: () => void;
  /** Sets selectedDay to today. Caller is responsible for also resetting the board week. */
  resetDayToToday: () => void;
}

export function useScheduleNavigation(): ScheduleNavigationResult {
  const [selectedTechId, setSelectedTechId] = useState("all");
  const [viewMode, setViewMode]             = useState<ViewMode>("week");
  const [selectedDay, setSelectedDay]       = useState(() => new Date());

  const prevDay      = () => setSelectedDay(d => addDays(d, -1));
  const nextDay      = () => setSelectedDay(d => addDays(d, 1));
  const resetDayToToday = () => setSelectedDay(new Date());

  return { selectedTechId, setSelectedTechId, viewMode, setViewMode, selectedDay, prevDay, nextDay, resetDayToToday };
}
