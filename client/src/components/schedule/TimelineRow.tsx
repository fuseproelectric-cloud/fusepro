import { memo } from "react";
import { cn } from "@/lib/utils";
import { TimelineJobCard } from "./TimelineJobCard";
import { TOTAL_TIMELINE_WIDTH, ROW_HEIGHT_PX } from "@/lib/schedule/timeline-utils";
import type { JobWithLayout } from "@/lib/schedule/timeline-utils";
import type { DragToTimeHandlers } from "@/hooks/useDragToTime";
import type { UseResizeJobReturn } from "@/hooks/useResizeJob";
import type { Job } from "@shared/schema";

interface TimelineRowProps {
  technicianId: number;
  name:         string;
  color:        string;
  jobs:         JobWithLayout[];
  rowIndex:     number;
  drag:         DragToTimeHandlers;
  resize:       UseResizeJobReturn;
  onJobClick:   (e: React.MouseEvent, job: Job) => void;
}

export const TimelineRow = memo(function TimelineRow({
  technicianId,
  name,
  color,
  jobs,
  rowIndex,
  drag,
  resize,
  onJobClick,
}: TimelineRowProps) {
  return (
    <div className="flex border-b border-border last:border-b-0">
      {/* ── Sticky tech name ── */}
      <div
        className="sticky left-0 z-10 flex-shrink-0 flex items-start gap-2 px-3 py-2
                   border-r border-border bg-card"
        style={{ width: 144, borderLeft: `3px solid ${color}` }}
      >
        <div
          className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-semibold text-foreground leading-snug break-words">
          {name}
        </span>
      </div>

      {/* ── Job canvas ── */}
      <div
        className={cn("relative flex-shrink-0")}
        style={{ width: TOTAL_TIMELINE_WIDTH, height: ROW_HEIGHT_PX }}
      >
        {/* Slot grid lines */}
        <div className="absolute inset-0 flex pointer-events-none">
          {Array.from({ length: Math.floor(TOTAL_TIMELINE_WIDTH / 72) }, (_, i) => (
            <div
              key={i}
              className={cn(
                "flex-shrink-0 border-r h-full",
                i % 2 === 0 ? "border-border/60" : "border-border/25"
              )}
              style={{ width: 72 }}
            />
          ))}
        </div>

        {/* Jobs */}
        {jobs.map(({ job, layout }) => (
          <TimelineJobCard
            key={job.id}
            job={job}
            layout={layout}
            color={color}
            isDragging={drag.dragJobId === job.id}
            rowIndex={rowIndex}
            drag={drag}
            resize={resize}
            onClick={onJobClick}
          />
        ))}
      </div>
    </div>
  );
});
