import { memo } from "react";
import { cn } from "@/lib/utils";
import {
  getTimeSlots,
  SLOT_WIDTH_PX,
  TOTAL_TIMELINE_WIDTH,
} from "@/lib/schedule/timeline-utils";

const SLOTS = getTimeSlots(); // stable — computed once at module load

interface TimelineHeaderProps {
  techColWidth: number;
}

export const TimelineHeader = memo(function TimelineHeader({ techColWidth }: TimelineHeaderProps) {
  return (
    <div
      className="sticky top-0 z-20 flex bg-card border-b border-border shadow-sm"
      style={{ minWidth: techColWidth + TOTAL_TIMELINE_WIDTH }}
    >
      {/* Corner cell that sits above the sticky tech column */}
      <div
        className="sticky left-0 z-30 flex-shrink-0 bg-card border-r border-border"
        style={{ width: techColWidth, height: 40 }}
      />

      {/* Time ruler */}
      <div className="flex relative flex-shrink-0" style={{ width: TOTAL_TIMELINE_WIDTH }}>
        {SLOTS.map(slot => (
          <div
            key={slot.index}
            className={cn(
              "flex-shrink-0 border-r border-border/50 relative",
              slot.isHour ? "border-border/80" : "border-border/30"
            )}
            style={{ width: SLOT_WIDTH_PX, height: 40 }}
          >
            {slot.isHour && (
              <span className="absolute left-1 top-1 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                {slot.label}
              </span>
            )}
            {!slot.isHour && (
              <span className="absolute left-1 bottom-1 text-[9px] text-muted-foreground/50">
                :{slot.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
