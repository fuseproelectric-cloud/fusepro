import { useQueryClient, useMutation } from "@tanstack/react-query";
import type { Job } from "@shared/schema";
import type { DropTarget } from "@/hooks/useJobDragAndDrop";
import { jobsApi } from "@/lib/api";
import { resolveDropTime } from "../utils/resolveDropTime";

// ── Variable types ────────────────────────────────────────────────────────────

interface ScheduleVars     { jobId: number; target: DropTarget }
interface WeekResizeVars   { jobId: number; scheduledAt: string; durationMin: number }
interface TimelineDragVars { jobId: number; newTechId: number | null; newStartTime: Date }
interface DayResizeVars    { jobId: number; newDurationMin: number; newStartTime?: Date }
interface AssignVars       { jobId: number; techId: number }

// ── Return type ───────────────────────────────────────────────────────────────

export interface ScheduleMutationsResult {
  invalidate:         () => void;
  onSchedule:         (jobId: number, target: DropTarget) => void;
  onWeekResize:       (jobId: number, scheduledAt: string, durationMin: number) => void;
  onTimelineDrag:     (jobId: number, newTechId: number | null, newStartTime: Date) => void;
  onDayResize:        (jobId: number, newDurationMin: number, newStartTime?: Date) => void;
  onAssignTech:       (jobId: number, techId: number) => void;
}

export function useScheduleMutations(): ScheduleMutationsResult {
  const qc = useQueryClient();

  // ── Shared optimistic-update helpers ────────────────────────────────────────
  const cancelAndSnapshot = async () => {
    await qc.cancelQueries({ queryKey: ["/api/jobs"] });
    return qc.getQueryData<Job[]>(["/api/jobs"]);
  };
  const rollback = (ctx: { previous?: Job[] } | undefined) => {
    if (ctx?.previous) qc.setQueryData(["/api/jobs"], ctx.previous);
  };
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/jobs"] });

  // ── Week-view: reschedule (drag to a DayCell) ────────────────────────────────
  const scheduleMutation = useMutation<unknown, Error, ScheduleVars, { previous?: Job[] }>({
    mutationFn: async ({ jobId, target }) => {
      const current = qc.getQueryData<Job[]>(["/api/jobs"])?.find(j => j.id === jobId);
      const scheduledAt = resolveDropTime(current, target);
      const patch: Partial<Job> = { scheduledAt: new Date(scheduledAt) };
      if (target.technicianId !== null) {
        patch.technicianId = target.technicianId;
        patch.status       = "assigned";
      }
      return jobsApi.update(jobId, patch as never);
    },
    onMutate: async ({ jobId, target }) => {
      const previous = await cancelAndSnapshot();
      qc.setQueryData<Job[]>(["/api/jobs"], old =>
        old?.map(j => {
          if (j.id !== jobId) return j;
          const scheduledAt = resolveDropTime(j, target);
          return {
            ...j,
            scheduledAt: new Date(scheduledAt),
            ...(target.technicianId !== null && {
              technicianId: target.technicianId,
              status: "assigned" as const,
            }),
          };
        }) ?? []
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: invalidate,
  });

  // ── Week-view: resize job handles ────────────────────────────────────────────
  const weekResizeMutation = useMutation<unknown, Error, WeekResizeVars, { previous?: Job[] }>({
    mutationFn: async ({ jobId, scheduledAt, durationMin }) =>
      jobsApi.update(jobId, {
        scheduledAt:       new Date(scheduledAt),
        estimatedDuration: durationMin,
      } as never),
    onMutate: async ({ jobId, scheduledAt, durationMin }) => {
      const previous = await cancelAndSnapshot();
      qc.setQueryData<Job[]>(["/api/jobs"], old =>
        old?.map(j => j.id !== jobId ? j : { ...j, scheduledAt: new Date(scheduledAt), estimatedDuration: durationMin }) ?? []
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: invalidate,
  });

  // ── Day-view: drag to exact time + optional tech reassign ────────────────────
  const timelineDragMutation = useMutation<unknown, Error, TimelineDragVars, { previous?: Job[] }>({
    mutationFn: async ({ jobId, newTechId, newStartTime }) => {
      const patch: Partial<Job> = { scheduledAt: newStartTime as unknown as Date };
      if (newTechId !== null) { patch.technicianId = newTechId; patch.status = "assigned"; }
      return jobsApi.update(jobId, patch as never);
    },
    onMutate: async ({ jobId, newTechId, newStartTime }) => {
      const previous = await cancelAndSnapshot();
      qc.setQueryData<Job[]>(["/api/jobs"], old =>
        old?.map(j => j.id !== jobId ? j : {
          ...j,
          scheduledAt: newStartTime,
          ...(newTechId !== null && { technicianId: newTechId, status: "assigned" as const }),
        }) ?? []
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: invalidate,
  });

  // ── Day-view: resize ─────────────────────────────────────────────────────────
  const dayResizeMutation = useMutation<unknown, Error, DayResizeVars, { previous?: Job[] }>({
    mutationFn: async ({ jobId, newDurationMin, newStartTime }) => {
      const patch: Partial<Job> = { estimatedDuration: newDurationMin };
      if (newStartTime) patch.scheduledAt = newStartTime as unknown as Date;
      return jobsApi.update(jobId, patch as never);
    },
    onMutate: async ({ jobId, newDurationMin, newStartTime }) => {
      const previous = await cancelAndSnapshot();
      qc.setQueryData<Job[]>(["/api/jobs"], old =>
        old?.map(j => j.id !== jobId ? j : {
          ...j,
          estimatedDuration: newDurationMin,
          ...(newStartTime && { scheduledAt: newStartTime }),
        }) ?? []
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: invalidate,
  });

  // ── Assign technician ────────────────────────────────────────────────────────
  const assignMutation = useMutation<unknown, Error, AssignVars>({
    mutationFn: ({ jobId, techId }) =>
      jobsApi.update(jobId, { technicianId: techId, status: "assigned" } as never),
    onSuccess: invalidate,
  });

  return {
    invalidate,
    onSchedule:     (jobId, target)                        => scheduleMutation.mutate({ jobId, target }),
    onWeekResize:   (jobId, scheduledAt, durationMin)      => weekResizeMutation.mutate({ jobId, scheduledAt, durationMin }),
    onTimelineDrag: (jobId, newTechId, newStartTime)       => timelineDragMutation.mutate({ jobId, newTechId, newStartTime }),
    onDayResize:    (jobId, newDurationMin, newStartTime)  => dayResizeMutation.mutate({ jobId, newDurationMin, newStartTime }),
    onAssignTech:   (jobId, techId)                        => assignMutation.mutate({ jobId, techId }),
  };
}
