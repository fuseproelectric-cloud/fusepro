import type { Job } from "@shared/schema";
import type { TechWithUser } from "@/lib/schedule/job-utils";
import type { DragAndDropHandlers } from "@/hooks/useJobDragAndDrop";
import type { DayCellResizeHandlers } from "@/hooks/useDayCellResize";
import type { UseScheduleBoardReturn } from "@/hooks/useScheduleBoard";
import type { ViewMode } from "@/components/schedule/ScheduleToolbar";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";
import { TimelineView } from "@/components/schedule/TimelineView";
import { UnscheduledSidebar } from "@/components/schedule/UnscheduledSidebar";

interface ScheduleBoardSectionProps {
  viewMode:              ViewMode;
  board:                 UseScheduleBoardReturn;
  drag:                  DragAndDropHandlers;
  weekResize:            DayCellResizeHandlers;
  selectedDay:           Date;
  technicians:           TechWithUser[];
  onJobClick:            (e: React.MouseEvent, job: Job) => void;
  onAddJobForDay:        (dayStr: string, technicianId?: number) => void;
  onCommitTimelineDrag:  (jobId: number, newTechId: number | null, newStartTime: Date) => void;
  onCommitTimelineResize:(jobId: number, newDurationMin: number, newStartTime?: Date) => void;
  onAssignTech:          (jobId: number, techId: number) => void;
}

export function ScheduleBoardSection({
  viewMode, board, drag, weekResize, selectedDay, technicians,
  onJobClick, onAddJobForDay, onCommitTimelineDrag, onCommitTimelineResize, onAssignTech,
}: ScheduleBoardSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {viewMode === "week" ? (
        <ScheduleGrid
          weekDays={board.weekDays}
          todayCT={board.todayCT}
          board={board.board}
          drag={drag}
          resize={weekResize}
          onJobClick={onJobClick}
          onAddJobForDay={onAddJobForDay}
        />
      ) : (
        <TimelineView
          board={board.board}
          selectedDay={selectedDay}
          onJobClick={onJobClick}
          onCommitDrag={(jobId, newTechId, newStartTime) =>
            onCommitTimelineDrag(jobId, newTechId, newStartTime)
          }
          onCommitResize={(jobId, newDurationMin, newStartTime) =>
            onCommitTimelineResize(jobId, newDurationMin, newStartTime)
          }
        />
      )}

      <UnscheduledSidebar
        jobs={board.unscheduledJobs}
        technicians={technicians}
        drag={drag}
        onJobClick={onJobClick}
        onAssignTech={(jobId, techId) => onAssignTech(jobId, techId)}
      />
    </div>
  );
}
