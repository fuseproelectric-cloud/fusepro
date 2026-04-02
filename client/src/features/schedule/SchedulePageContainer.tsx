import { useQueryClient } from "@tanstack/react-query";
import type { Job } from "@shared/schema";
import { useScheduleBoard } from "@/hooks/useScheduleBoard";
import { useJobDragAndDrop } from "@/hooks/useJobDragAndDrop";
import { useDayCellResize } from "@/hooks/useDayCellResize";
import { ScheduleToolbar } from "@/components/schedule/ScheduleToolbar";
import { useScheduleData } from "./hooks/useScheduleData";
import { useScheduleMutations } from "./hooks/useScheduleMutations";
import { useScheduleNavigation } from "./hooks/useScheduleNavigation";
import { useScheduleDialogs } from "./hooks/useScheduleDialogs";
import { ScheduleBoardSection } from "./ScheduleBoardSection";
import { ScheduleDialogs } from "./ScheduleDialogs";
import { jobsApi } from "@/lib/api";

export function SchedulePageContainer() {
  const qc = useQueryClient();

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { jobs, technicians, customers } = useScheduleData();

  // ── Mutations ────────────────────────────────────────────────────────────────
  const mutations = useScheduleMutations();

  // ── Navigation + view state ──────────────────────────────────────────────────
  const nav = useScheduleNavigation();

  // ── Dialog state ─────────────────────────────────────────────────────────────
  const dialogs = useScheduleDialogs();

  // ── Board (depends on jobs + technicians + selectedTechId from nav) ──────────
  const board = useScheduleBoard(jobs, technicians, { selectedTechId: nav.selectedTechId });

  // ── Week-view drag ───────────────────────────────────────────────────────────
  const drag = useJobDragAndDrop((jobId, target) => mutations.onSchedule(jobId, target));

  // ── Week-view resize ─────────────────────────────────────────────────────────
  const weekResize = useDayCellResize({
    onCommit: (jobId, scheduledAt, durationMin) =>
      mutations.onWeekResize(jobId, scheduledAt, durationMin),
  });

  // ── Composed handlers ────────────────────────────────────────────────────────

  // goToToday must reset both the board week and the day-view selected day.
  const goToToday = () => {
    board.goToToday();
    nav.resetDayToToday();
  };

  // handleJobClick bridges drag state (drag.wasDragged) with dialog state.
  // It lives in the container because it wires two independent concerns.
  const handleJobClick = (_e: React.MouseEvent, job: Job) => {
    if (drag.wasDragged()) return;
    dialogs.setSelectedJob(
      qc.getQueryData<Job[]>(["/api/jobs"])?.find(j => j.id === job.id) ?? job
    );
  };

  const handleSaveEdit = async (patch: Record<string, unknown>) => {
    if (!dialogs.selectedJob) return;
    await jobsApi.update(dialogs.selectedJob.id, patch as never);
    mutations.invalidate();
  };

  return (
    <div className="space-y-4">
      <ScheduleToolbar
        weekDays={board.weekDays}
        onPrevWeek={board.prevWeek}
        onNextWeek={board.nextWeek}
        onToday={goToToday}
        viewMode={nav.viewMode}
        onViewModeChange={nav.setViewMode}
        selectedDay={nav.selectedDay}
        onPrevDay={nav.prevDay}
        onNextDay={nav.nextDay}
        selectedTechId={nav.selectedTechId}
        technicians={technicians}
        onTechChange={nav.setSelectedTechId}
        onNewJob={() => dialogs.setCreateForDay(new Date())}
      />

      <ScheduleBoardSection
        viewMode={nav.viewMode}
        board={board}
        drag={drag}
        weekResize={weekResize}
        selectedDay={nav.selectedDay}
        technicians={technicians}
        onJobClick={handleJobClick}
        onAddJobForDay={dialogs.handleAddJobForDay}
        onCommitTimelineDrag={mutations.onTimelineDrag}
        onCommitTimelineResize={mutations.onDayResize}
        onAssignTech={mutations.onAssignTech}
      />

      <ScheduleDialogs
        selectedJob={dialogs.selectedJob}
        createForDay={dialogs.createForDay}
        createForTechId={dialogs.createForTechId}
        technicians={technicians}
        customers={customers}
        onCloseEdit={() => dialogs.setSelectedJob(null)}
        onSaveEdit={handleSaveEdit}
        onCloseCreate={dialogs.closeCreate}
        onCreated={mutations.invalidate}
      />
    </div>
  );
}
