import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { jobsApi, techniciansApi, customersApi } from "@/lib/api";
import type { Job } from "@shared/schema";
import type { TechWithUser, Customer } from "@/lib/schedule/job-utils";
import type { DropTarget } from "@/hooks/useJobDragAndDrop";
import type { ViewMode } from "@/components/schedule/ScheduleToolbar";
import { getDateFromPosition } from "@/lib/schedule/timeline-layout";
import { fromCTDayAndMinutes, toCTMinutes } from "@/lib/schedule/ct-time";
import { useScheduleBoard } from "@/hooks/useScheduleBoard";
import { useJobDragAndDrop } from "@/hooks/useJobDragAndDrop";
import { useDayCellResize } from "@/hooks/useDayCellResize";
import { ScheduleToolbar } from "@/components/schedule/ScheduleToolbar";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";
import { TimelineView } from "@/components/schedule/TimelineView";
import { UnscheduledSidebar } from "@/components/schedule/UnscheduledSidebar";
import { JobEditDialog } from "@/components/schedule/JobEditDialog";
import { CreateJobDialog } from "@/components/schedule/CreateJobDialog";
import { dateStrCT } from "@/lib/schedule/date-utils";

export function SchedulePage() {
  const qc = useQueryClient();
  const [selectedTechId, setSelectedTechId] = useState("all");
  const [viewMode, setViewMode]             = useState<ViewMode>("week");
  const [selectedDay, setSelectedDay]       = useState(() => new Date());
  const [selectedJob, setSelectedJob]       = useState<Job | null>(null);
  const [createForDay, setCreateForDay]     = useState<Date | null>(null);
  const [createForTechId, setCreateForTechId] = useState<number | undefined>(undefined);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: jobs = [] }        = useQuery<Job[]>({
    queryKey: ["/api/jobs"],        queryFn: jobsApi.getAll,
  });
  const { data: technicians = [] } = useQuery<TechWithUser[]>({
    queryKey: ["/api/technicians"], queryFn: techniciansApi.getAll,
  });
  const { data: customers = [] }   = useQuery<Customer[]>({
    queryKey: ["/api/customers"],   queryFn: customersApi.getAll,
  });

  // ── Shared optimistic-update helpers ─────────────────────────────────────────
  const cancelAndSnapshot = async () => {
    await qc.cancelQueries({ queryKey: ["/api/jobs"] });
    return qc.getQueryData<Job[]>(["/api/jobs"]);
  };
  const rollback = (ctx: { previous?: Job[] } | undefined) => {
    if (ctx?.previous) qc.setQueryData(["/api/jobs"], ctx.previous);
  };
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/jobs"] });

  // ── Week-view: reschedule (drag to a DayCell) ─────────────────────────────────
  const scheduleMutation = useMutation({
    mutationFn: async ({ jobId, target }: { jobId: number; target: DropTarget }) => {
      const current = qc.getQueryData<Job[]>(["/api/jobs"])?.find(j => j.id === jobId);

      // When a drop X-position is available, derive exact CT time from it.
      // Otherwise preserve the existing time on the job (same-time day-shift).
      const scheduledAt = resolveDropTime(current, target);

      const patch: Partial<Job> = { scheduledAt: new Date(scheduledAt) as unknown as string };
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
            scheduledAt,
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

  // ── Week-view: resize job handles ─────────────────────────────────────────────
  const weekResizeMutation = useMutation({
    mutationFn: async ({
      jobId, scheduledAt, durationMin,
    }: { jobId: number; scheduledAt: string; durationMin: number }) => {
      return jobsApi.update(jobId, {
        scheduledAt:       new Date(scheduledAt) as unknown as string,
        estimatedDuration: durationMin,
      } as never);
    },
    onMutate: async ({ jobId, scheduledAt, durationMin }) => {
      const previous = await cancelAndSnapshot();
      qc.setQueryData<Job[]>(["/api/jobs"], old =>
        old?.map(j => j.id !== jobId ? j : {
          ...j, scheduledAt, estimatedDuration: durationMin,
        }) ?? []
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: invalidate,
  });

  // ── Day-view: drag to exact time + optional tech reassign ─────────────────────
  const timelineDragMutation = useMutation({
    mutationFn: async ({
      jobId, newTechId, newStartTime,
    }: { jobId: number; newTechId: number | null; newStartTime: Date }) => {
      const patch: Partial<Job> = { scheduledAt: newStartTime.toISOString() as unknown as string };
      if (newTechId !== null) { patch.technicianId = newTechId; patch.status = "assigned"; }
      return jobsApi.update(jobId, patch as never);
    },
    onMutate: async ({ jobId, newTechId, newStartTime }) => {
      const previous = await cancelAndSnapshot();
      qc.setQueryData<Job[]>(["/api/jobs"], old =>
        old?.map(j => j.id !== jobId ? j : {
          ...j,
          scheduledAt: newStartTime.toISOString(),
          ...(newTechId !== null && { technicianId: newTechId, status: "assigned" as const }),
        }) ?? []
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: invalidate,
  });

  // ── Day-view: resize ──────────────────────────────────────────────────────────
  const dayResizeMutation = useMutation({
    mutationFn: async ({
      jobId, newDurationMin, newStartTime,
    }: { jobId: number; newDurationMin: number; newStartTime?: Date }) => {
      const patch: Partial<Job> = { estimatedDuration: newDurationMin };
      if (newStartTime) patch.scheduledAt = newStartTime.toISOString() as unknown as string;
      return jobsApi.update(jobId, patch as never);
    },
    onMutate: async ({ jobId, newDurationMin, newStartTime }) => {
      const previous = await cancelAndSnapshot();
      qc.setQueryData<Job[]>(["/api/jobs"], old =>
        old?.map(j => j.id !== jobId ? j : {
          ...j,
          estimatedDuration: newDurationMin,
          ...(newStartTime && { scheduledAt: newStartTime.toISOString() }),
        }) ?? []
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => rollback(ctx),
    onSettled: invalidate,
  });

  const assignMutation = useMutation({
    mutationFn: ({ jobId, techId }: { jobId: number; techId: number }) =>
      jobsApi.update(jobId, { technicianId: techId, status: "assigned" } as never),
    onSuccess: invalidate,
  });

  // ── Board ─────────────────────────────────────────────────────────────────────
  const board = useScheduleBoard(jobs, technicians, { selectedTechId });

  // ── Week-view drag ────────────────────────────────────────────────────────────
  const drag = useJobDragAndDrop((jobId, target) =>
    scheduleMutation.mutate({ jobId, target })
  );

  // ── Week-view resize ──────────────────────────────────────────────────────────
  // One hook instance shared across all DayCells.
  // dayStr is passed per-call (not at hook creation time), so it works for all 7 days.
  const weekResize = useDayCellResize({
    onCommit: (jobId, scheduledAt, durationMin) =>
      weekResizeMutation.mutate({ jobId, scheduledAt, durationMin }),
  });

  const handleJobClick = (e: React.MouseEvent, job: Job) => {
    if (drag.wasDragged()) return;
    setSelectedJob(qc.getQueryData<Job[]>(["/api/jobs"])?.find(j => j.id === job.id) ?? job);
  };

  const handleAddJobForDay = (dayStr: string, technicianId?: number) => {
    setCreateForDay(fromCTDayAndMinutes(dayStr, 9 * 60));
    setCreateForTechId(technicianId);
  };

  // ── Day navigation ────────────────────────────────────────────────────────────
  const prevDay   = () => setSelectedDay(d => addDays(d, -1));
  const nextDay   = () => setSelectedDay(d => addDays(d, 1));
  const goToToday = () => { board.goToToday(); setSelectedDay(new Date()); };

  return (
    <div className="space-y-4">
      <ScheduleToolbar
        weekDays={board.weekDays}
        onPrevWeek={board.prevWeek}
        onNextWeek={board.nextWeek}
        onToday={goToToday}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedDay={selectedDay}
        onPrevDay={prevDay}
        onNextDay={nextDay}
        selectedTechId={selectedTechId}
        technicians={technicians}
        onTechChange={setSelectedTechId}
        onNewJob={() => setCreateForDay(new Date())}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {viewMode === "week" ? (
          <ScheduleGrid
            weekDays={board.weekDays}
            todayCT={board.todayCT}
            board={board.board}
            drag={drag}
            resize={weekResize}
            onJobClick={handleJobClick}
            onAddJobForDay={handleAddJobForDay}
          />
        ) : (
          <TimelineView
            board={board.board}
            selectedDay={selectedDay}
            onJobClick={handleJobClick}
            onCommitDrag={(jobId, newTechId, newStartTime) =>
              timelineDragMutation.mutate({ jobId, newTechId, newStartTime })
            }
            onCommitResize={(jobId, newDurationMin, newStartTime) =>
              dayResizeMutation.mutate({ jobId, newDurationMin, newStartTime })
            }
          />
        )}

        <UnscheduledSidebar
          jobs={board.unscheduledJobs}
          technicians={technicians}
          drag={drag}
          onJobClick={handleJobClick}
          onAssignTech={(jobId, techId) => assignMutation.mutate({ jobId, techId })}
        />
      </div>

      {selectedJob && (
        <JobEditDialog
          job={selectedJob}
          technicians={technicians}
          customers={customers}
          onClose={() => setSelectedJob(null)}
          onSave={async patch => {
            await jobsApi.update(selectedJob.id, patch as never);
            invalidate();
          }}
        />
      )}

      {createForDay && (
        <CreateJobDialog
          defaultDate={createForDay}
          technicians={technicians}
          customers={customers}
          defaultTechnicianId={createForTechId}
          onClose={() => { setCreateForDay(null); setCreateForTechId(undefined); }}
          onCreated={invalidate}
        />
      )}
    </div>
  );
}

// ── Pure helper ───────────────────────────────────────────────────────────────

/**
 * Determine the new scheduledAt ISO string for a week-view drag.
 *
 * Priority:
 * 1. Drop X position → exact CT time via getDateFromPosition (no local-TZ math)
 * 2. Preserve the existing job time on the new day via fromCTDayAndMinutes
 * 3. Default to 09:00 CT
 */
function resolveDropTime(job: Job | undefined, target: DropTarget): string {
  if (target.dropOffsetX !== undefined && target.cellWidth !== undefined) {
    return getDateFromPosition(target.dropOffsetX, target.cellWidth, target.dayStr).toISOString();
  }
  const ctMin = job?.scheduledAt ? toCTMinutes(new Date(job.scheduledAt)) : 9 * 60;
  return fromCTDayAndMinutes(target.dayStr, ctMin).toISOString();
}
