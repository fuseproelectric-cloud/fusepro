import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TechnicianRow } from "./TechnicianRow";
import { dateStrCT } from "@/lib/schedule/date-utils";
import { currentTimePct } from "@/lib/schedule/timeline-layout";
import type { ScheduleBoard } from "@/lib/schedule/board-builder";
import type { Job } from "@shared/schema";
import type { DragAndDropHandlers } from "@/hooks/useJobDragAndDrop";
import type { DayCellResizeHandlers } from "@/hooks/useDayCellResize";

// Width of the sticky tech-name column — must match TechnicianRow.tsx
const TECH_COL_W  = 140;
// Min width of each day column — wide enough to show the mini-timeline usefully
const DAY_COL_MIN = 160;

interface ScheduleGridProps {
  weekDays:       Date[];
  todayCT:        string;
  board:          ScheduleBoard;
  drag:           DragAndDropHandlers;
  resize:         DayCellResizeHandlers;
  onJobClick:     (e: React.MouseEvent, job: Job) => void;
  onAddJobForDay: (dayStr: string, technicianId?: number) => void;
}

export function ScheduleGrid({
  weekDays,
  todayCT,
  board,
  drag,
  resize,
  onJobClick,
  onAddJobForDay,
}: ScheduleGridProps) {
  const weekDayStrs = weekDays.map(d => dateStrCT(d));

  // Current-time indicator — computed once here, passed to every DayCell
  const [nowPct, setNowPct] = useState(currentTimePct);
  useEffect(() => {
    const id = setInterval(() => setNowPct(currentTimePct()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Scroll today's column to the left edge (after tech col) when week changes
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const todayIndex = weekDayStrs.indexOf(todayCT);
    if (todayIndex === -1) return; // today not in this week
    const container = scrollContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      // Scroll so today column is the first visible column (left-aligned after tech col)
      container.scrollTo({
        left: TECH_COL_W + todayIndex * DAY_COL_MIN,
        behavior: "smooth",
      });
    });
  }, [weekDayStrs, todayCT]);

  return (
    <Card className="lg:col-span-3 bg-card border-border overflow-hidden">
      <CardContent className="p-0">
        <div ref={scrollContainerRef} className="overflow-x-auto">
          <div style={{ minWidth: TECH_COL_W + 7 * DAY_COL_MIN }}>

            {/* ── Sticky day-header row ── */}
            <div className="flex sticky top-0 z-10 bg-card border-b border-border shadow-sm">
              {/* Spacer over the tech-name column */}
              <div
                className="flex-shrink-0 border-r border-border bg-muted/10"
                style={{ width: TECH_COL_W }}
              />
              {/* Day headers */}
              <div className="flex-1 grid grid-cols-7">
                {weekDays.map(day => {
                  const isToday = dateStrCT(day) === todayCT;
                  return (
                    <div
                      key={dateStrCT(day)}
                      className={cn(
                        "text-center py-2 border-r border-border last:border-r-0",
                        isToday && "bg-orange-500/10",
                      )}
                    >
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {format(day, "EEE")}
                      </p>
                      <p className={cn(
                        "text-base font-bold leading-tight",
                        isToday ? "text-orange-500" : "text-foreground",
                      )}>
                        {format(day, "d")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Technician rows ── */}
            {board.technicians.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                No technicians found
              </div>
            ) : (
              board.technicians.map(tech => (
                <TechnicianRow
                  key={tech.technicianId}
                  technicianId={tech.technicianId}
                  name={tech.name}
                  color={tech.color}
                  days={tech.days}
                  weekDayStrs={weekDayStrs}
                  todayCT={todayCT}
                  nowPct={nowPct}
                  drag={drag}
                  resize={resize}
                  onJobClick={onJobClick}
                  onAddJob={onAddJobForDay}
                />
              ))
            )}

          </div>
        </div>
      </CardContent>
    </Card>
  );
}
