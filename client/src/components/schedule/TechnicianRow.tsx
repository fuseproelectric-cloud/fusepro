import { memo } from "react";
import { DayCell, CELL_H } from "./DayCell";
import type { Job } from "@shared/schema";
import type { DragAndDropHandlers } from "@/hooks/useJobDragAndDrop";
import type { DayCellResizeHandlers } from "@/hooks/useDayCellResize";

interface TechnicianRowProps {
  technicianId: number;
  name:         string;
  color:        string;
  /** CT date string → jobs for that day */
  days:         Record<string, Job[]>;
  weekDayStrs:  string[];
  todayCT:      string;
  /** Current-time % (or -1 when outside visible range). Computed once at grid level. */
  nowPct:       number;
  drag:         DragAndDropHandlers;
  resize:       DayCellResizeHandlers;
  onJobClick:   (e: React.MouseEvent, job: Job) => void;
  onAddJob:     (dayStr: string, technicianId: number) => void;
}

export const TechnicianRow = memo(function TechnicianRow({
  technicianId,
  name,
  color,
  days,
  weekDayStrs,
  todayCT,
  nowPct,
  drag,
  resize,
  onJobClick,
  onAddJob,
}: TechnicianRowProps) {
  return (
    <div className="flex border-b border-border last:border-b-0">
      {/* Tech name column */}
      <div
        className="w-[140px] flex-shrink-0 flex items-start gap-2 px-3 py-2
                   border-r border-border bg-muted/10"
        style={{
          borderLeft: `3px solid ${color}`,
          height: CELL_H,
        }}
      >
        <div
          className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-semibold text-foreground leading-snug break-words">
          {name}
        </span>
      </div>

      {/* 7 day cells */}
      <div className="flex-1 grid grid-cols-7">
        {weekDayStrs.map(dayStr => (
          <DayCell
            key={dayStr}
            dayStr={dayStr}
            technicianId={technicianId}
            jobs={days[dayStr] ?? []}
            techColor={color}
            isToday={dayStr === todayCT}
            nowPct={dayStr === todayCT ? nowPct : -1}
            drag={drag}
            resize={resize}
            onJobClick={onJobClick}
            onAddJob={() => onAddJob(dayStr, technicianId)}
          />
        ))}
      </div>
    </div>
  );
});
