import { memo, useRef } from "react";
import { cn, formatStatus } from "@/lib/utils";
import { fmtTime } from "@/lib/time";
import type { Job } from "@shared/schema";
import type { JobLayout } from "@/lib/schedule/timeline-utils";
import type { DragToTimeHandlers } from "@/hooks/useDragToTime";
import type { UseResizeJobReturn } from "@/hooks/useResizeJob";

// Status → accent colors for the card
const STATUS_BG: Record<string, string> = {
  pending:     "opacity-70",
  assigned:    "",
  in_progress: "ring-1 ring-inset ring-orange-400/50",
  completed:   "opacity-50 saturate-50",
  cancelled:   "opacity-25",
};

const STATUS_DOT: Record<string, string> = {
  pending:     "bg-gray-400",
  assigned:    "bg-blue-500",
  in_progress: "bg-orange-500 animate-pulse",
  completed:   "bg-green-500",
  cancelled:   "bg-gray-300",
};

interface TimelineJobCardProps {
  job:          Job;
  layout:       JobLayout;
  color:        string;
  isDragging:   boolean;
  rowIndex:     number;
  drag:         DragToTimeHandlers;
  resize:       UseResizeJobReturn;
  onClick:      (e: React.MouseEvent, job: Job) => void;
}

export const TimelineJobCard = memo(function TimelineJobCard({
  job,
  layout,
  color,
  isDragging,
  rowIndex,
  drag,
  resize,
  onClick,
}: TimelineJobCardProps) {
  const elemRef = useRef<HTMLDivElement>(null);

  const handleResizeStart = (e: React.MouseEvent, handle: "left" | "right") => {
    if (!elemRef.current) return;
    resize.onResizeStart(
      e, job.id, handle, elemRef.current,
      layout.left, layout.width,
      job.scheduledAt?.toString() ?? "",
      job.estimatedDuration ?? 60
    );
  };

  return (
    <div
      ref={elemRef}
      className={cn(
        "absolute rounded-[4px] select-none overflow-hidden",
        "group/card transition-opacity",
        "border border-white/30",
        STATUS_BG[job.status] ?? "",
        isDragging && "opacity-20 pointer-events-none"
      )}
      style={{
        left:            layout.left,
        top:             layout.top + 2,
        width:           layout.width,
        height:          layout.height,
        backgroundColor: `${color}22`,
        borderLeft:      `3px solid ${color}`,
        zIndex:          isDragging ? 0 : layout.column + 1,
      }}
      onMouseDown={e => drag.startDrag(e, job, rowIndex)}
      onClick={e => onClick(e, job)}
    >
      {/* Content */}
      <div className="flex flex-col h-full px-1.5 py-0.5 min-w-0">
        {/* Title + status dot */}
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_DOT[job.status])}
          />
          <span
            className="text-[11px] font-semibold text-foreground truncate leading-tight"
            title={job.title}
          >
            {job.title}
          </span>
        </div>

        {/* Time */}
        {layout.height > 28 && job.scheduledAt && (
          <span className="text-[10px] text-muted-foreground leading-tight pl-2.5 truncate">
            {fmtTime(job.scheduledAt)}
            {job.estimatedDuration ? ` · ${job.estimatedDuration}m` : ""}
          </span>
        )}

        {/* Address */}
        {layout.height > 44 && job.address && (
          <span className="text-[10px] text-muted-foreground/70 leading-tight pl-2.5 truncate">
            {job.address}
          </span>
        )}
      </div>

      {/* Resize handles — visible on hover */}
      <div
        className="absolute left-0 top-0 w-2 h-full cursor-ew-resize
                   opacity-0 group-hover/card:opacity-100 transition-opacity
                   hover:bg-white/20 rounded-l-[4px]"
        onMouseDown={e => handleResizeStart(e, "left")}
      />
      <div
        className="absolute right-0 top-0 w-2 h-full cursor-ew-resize
                   opacity-0 group-hover/card:opacity-100 transition-opacity
                   hover:bg-white/20 rounded-r-[4px]"
        onMouseDown={e => handleResizeStart(e, "right")}
      />
    </div>
  );
});
