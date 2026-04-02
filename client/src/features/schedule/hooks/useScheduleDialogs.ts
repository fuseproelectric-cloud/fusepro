import { useState } from "react";
import type { Job } from "@shared/schema";
import { fromCTDayAndMinutes } from "@/lib/schedule/ct-time";

export interface ScheduleDialogsResult {
  selectedJob: Job | null;
  setSelectedJob: (job: Job | null) => void;
  createForDay: Date | null;
  setCreateForDay: (date: Date | null) => void;
  createForTechId: number | undefined;
  handleAddJobForDay: (dayStr: string, technicianId?: number) => void;
  closeCreate: () => void;
}

export function useScheduleDialogs(): ScheduleDialogsResult {
  const [selectedJob, setSelectedJob]           = useState<Job | null>(null);
  const [createForDay, setCreateForDay]         = useState<Date | null>(null);
  const [createForTechId, setCreateForTechId]   = useState<number | undefined>(undefined);

  const handleAddJobForDay = (dayStr: string, technicianId?: number) => {
    setCreateForDay(fromCTDayAndMinutes(dayStr, 9 * 60));
    setCreateForTechId(technicianId);
  };

  const closeCreate = () => {
    setCreateForDay(null);
    setCreateForTechId(undefined);
  };

  return { selectedJob, setSelectedJob, createForDay, setCreateForDay, createForTechId, handleAddJobForDay, closeCreate };
}
