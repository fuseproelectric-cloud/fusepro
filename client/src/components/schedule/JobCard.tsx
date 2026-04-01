import { memo } from "react";
import { Clock, MapPin } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { cn, formatStatus } from "@/lib/utils";
import { fmtTime } from "@/lib/time";
import type { Job } from "@shared/schema";

// Status → visual accent (background tint)
const STATUS_TINT: Record<string, string> = {
  pending:     "opacity-60",
  assigned:    "",
  in_progress: "ring-1 ring-orange-400/40",
  completed:   "opacity-50",
  cancelled:   "opacity-30 line-through",
};

const STATUS_DOT: Record<string, string> = {
  pending:     "bg-gray-400",
  assigned:    "bg-blue-500",
  in_progress: "bg-orange-500",
  completed:   "bg-green-500",
  cancelled:   "bg-gray-300",
};

interface JobCardProps {
  job: Job;
  techColor: string;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: (e: React.MouseEvent) => void;
}

export const JobCard = memo(function JobCard({
  job,
  techColor,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: JobCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "rounded-[5px] p-1.5 text-xs cursor-grab active:cursor-grabbing select-none",
        "hover:shadow-md hover:brightness-105 transition-all duration-100",
        STATUS_TINT[job.status] ?? "",
        isDragging && "opacity-30 scale-95"
      )}
      style={{
        backgroundColor: `${techColor}18`,
        borderLeft: `3px solid ${techColor}`,
      }}
    >
      {/* Title + status dot */}
      <div className="flex items-start gap-1">
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[3px]",
            STATUS_DOT[job.status] ?? "bg-gray-400"
          )}
        />
        <p className="font-semibold text-foreground leading-tight truncate flex-1">{job.title}</p>
      </div>

      {/* Time */}
      {job.scheduledAt && (
        <p className="text-muted-foreground flex items-center gap-0.5 mt-0.5 pl-2.5">
          <Icon icon={Clock} size={10} className="flex-shrink-0" />
          <span>{fmtTime(job.scheduledAt)}</span>
        </p>
      )}

      {/* Address (if short enough) */}
      {job.address && (
        <p className="text-muted-foreground/70 flex items-center gap-0.5 mt-0.5 pl-2.5 truncate">
          <Icon icon={MapPin} size={10} className="flex-shrink-0" />
          <span className="truncate">{job.address}</span>
        </p>
      )}
    </div>
  );
});
