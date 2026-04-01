import { useRef, useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TimelineHeader } from "./TimelineHeader";
import { TimelineRow } from "./TimelineRow";
import { useTimelineLayout } from "@/hooks/useTimelineLayout";
import { useDragToTime } from "@/hooks/useDragToTime";
import { useResizeJob } from "@/hooks/useResizeJob";
import {
  TECH_COL_WIDTH,
  TOTAL_TIMELINE_WIDTH,
  ROW_HEIGHT_PX,
  currentTimeLeftPx,
} from "@/lib/schedule/timeline-utils";
import type { ScheduleBoard } from "@/lib/schedule/board-builder";
import type { Job } from "@shared/schema";

interface TimelineViewProps {
  board:       ScheduleBoard;
  selectedDay: Date;
  onJobClick:  (e: React.MouseEvent, job: Job) => void;
  onCommitDrag:   (jobId: number, newTechId: number | null, newStartTime: Date) => void;
  onCommitResize: (jobId: number, newDurationMin: number, newStartTime?: Date) => void;
}

export function TimelineView({
  board,
  selectedDay,
  onJobClick,
  onCommitDrag,
  onCommitResize,
}: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const techRows  = useTimelineLayout(board, selectedDay);

  // ── Current time indicator ─────────────────────────────────────────────────
  const [nowLeft, setNowLeft] = useState(currentTimeLeftPx);
  useEffect(() => {
    const id = setInterval(() => setNowLeft(currentTimeLeftPx()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || nowLeft < 0) return;
    el.scrollLeft = Math.max(0, nowLeft + TECH_COL_WIDTH - el.clientWidth / 2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drag to time ──────────────────────────────────────────────────────────
  const drag = useDragToTime({
    scrollRef,
    techRows,
    selectedDay,
    onCommit: onCommitDrag,
  });

  // ── Resize ────────────────────────────────────────────────────────────────
  const resize = useResizeJob({ selectedDay, onCommit: onCommitResize });

  return (
    <Card className="lg:col-span-3 bg-card border-border overflow-hidden">
      <CardContent className="p-0">

        {/* The single scrollable container for both axes */}
        <div
          ref={scrollRef}
          className="overflow-auto"
          style={{ maxHeight: "calc(100vh - 200px)" }}
        >
          <div style={{ minWidth: TECH_COL_WIDTH + TOTAL_TIMELINE_WIDTH }}>

            {/* Sticky top header */}
            <TimelineHeader techColWidth={TECH_COL_WIDTH} />

            {/* Tech rows */}
            <div className="relative">
              {techRows.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  No technicians found
                </div>
              ) : (
                techRows.map((row, rowIndex) => (
                  <TimelineRow
                    key={row.technicianId}
                    technicianId={row.technicianId}
                    name={row.name}
                    color={row.color}
                    jobs={row.jobs}
                    rowIndex={rowIndex}
                    drag={drag}
                    resize={resize}
                    onJobClick={onJobClick}
                  />
                ))
              )}

              {/* ── Current time vertical line ── */}
              {nowLeft >= 0 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
                  style={{ left: TECH_COL_WIDTH + nowLeft }}
                >
                  <div className="absolute -top-1 -left-[4px] w-2 h-2 rounded-full bg-red-500" />
                </div>
              )}

              {/* ── Drag preview ghost ── */}
              {drag.dragPreview && (
                <div
                  className={cn(
                    "absolute rounded-[4px] border-2 border-dashed border-blue-400",
                    "bg-blue-400/20 pointer-events-none z-50 transition-none"
                  )}
                  style={{
                    left:   TECH_COL_WIDTH + drag.dragPreview.left,
                    top:    drag.dragPreview.top + 2,
                    width:  drag.dragPreview.width,
                    height: ROW_HEIGHT_PX - 4,
                  }}
                />
              )}
            </div>

          </div>
        </div>
      </CardContent>
    </Card>
  );
}
