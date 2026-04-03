/**
 * DayCell — week-view mini-timeline cell.
 *
 * Layout:
 *   [ 14px time-header strip  ← hour labels          ]
 *   [ 74px timeline body      ← absolutely positioned jobs ]
 *
 * Features:
 *   • Jobs positioned by start/end time (% widths)
 *   • Overlap stacking (resolveOverlaps)
 *   • Drag preview ghost + time label during dragover
 *   • Left/right resize handles per job card
 *   • Current-time vertical line
 *   • Drop → computes exact time from mouse X
 */

import { memo, useRef, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import type { Job } from "@shared/schema";
import type { DragAndDropHandlers, DropTarget } from "@/hooks/useJobDragAndDrop";
import type { DayCellResizeHandlers } from "@/hooks/useDayCellResize";
import {
  resolveOverlaps, getHourTicks, getTimeFromPosition, currentTimePct,
  DAY_START_H, DAY_END_H, SNAP_MIN,
  type JobLayout,
} from "@/lib/schedule/timeline-layout";
import { fmtRange, fmtMinutes } from "@/lib/schedule/ct-time";

// ── Constants ─────────────────────────────────────────────────────────────────
const HEADER_H  = 14; // px — time label strip height
const BODY_H    = 72; // px — timeline area height
export const CELL_H = HEADER_H + BODY_H; // 86px total

// Hour ticks computed once at module load (stable reference)
const HOUR_TICKS     = getHourTicks(false);
// Sparse labels: only show every 2 hours in the header strip
const LABEL_HOURS    = [6, 9, 12, 15, 18] as const;
const LABEL_TICKS    = HOUR_TICKS.filter(t =>
  LABEL_HOURS.some(h => Math.abs(t.pct - ((h - DAY_START_H) / (DAY_END_H - DAY_START_H)) * 100) < 0.1)
);

// Status dot colors
const STATUS_DOT: Record<string, string> = {
  pending:     "bg-gray-400",
  assigned:    "bg-blue-500",
  in_progress: "bg-blue-500 animate-pulse",
  completed:   "bg-green-500",
  cancelled:   "bg-gray-300",
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface JobCardProps {
  job:        Job;
  layout:     JobLayout;
  techColor:  string;
  isDragging: boolean;
  dayStr:     string;
  drag:       DragAndDropHandlers;
  resize:     DayCellResizeHandlers;
  cellWidth:  number;
  onClick:    (e: React.MouseEvent, job: Job) => void;
}

const JobCard = memo(function JobCard({
  job, layout, techColor, isDragging, dayStr, drag, resize, cellWidth, onClick,
}: JobCardProps) {
  const elemRef = useRef<HTMLDivElement>(null);
  const dur     = job.estimatedDuration ?? 60;
  const label   = fmtRange(layout.startMin, layout.endMin);

  const startResize = (e: React.MouseEvent, handle: "left" | "right") => {
    if (!elemRef.current) return;
    resize.onResizeStart(e, job.id, handle, elemRef.current, cellWidth, layout.startMin, layout.endMin, dayStr);
  };

  return (
    <div
      ref={elemRef}
      draggable
      onDragStart={e => drag.onDragStart(e, job.id)}
      onDragEnd={drag.onDragEnd}
      onClick={e => { e.stopPropagation(); onClick(e, job); }}
      title={`${job.title}\n${label}${dur ? ` · ${dur}m` : ""}`}
      className={cn(
        "absolute group/card rounded-[3px] select-none overflow-hidden",
        "border border-white/20",
        "cursor-grab active:cursor-grabbing",
        "hover:z-20 hover:shadow-md hover:brightness-110",
        "transition-[box-shadow,filter] duration-100",
        isDragging             && "opacity-20 pointer-events-none",
        job.status === "completed" && "opacity-50 saturate-50",
        job.status === "cancelled" && "opacity-20",
      )}
      style={{
        left:            `${layout.leftPct}%`,
        width:           `${layout.widthPct}%`,
        top:             `${layout.topPct}%`,
        height:          `${layout.heightPct}%`,
        backgroundColor: `${techColor}28`,
        borderLeft:      `2.5px solid ${techColor}`,
        minWidth:        40,
        zIndex:          isDragging ? 0 : layout.topPct === 0 ? 2 : 3,
      }}
    >
      {/* Card content */}
      <div className="flex flex-col h-full px-1 py-0.5 min-w-0 overflow-hidden">
        {/* Row 1: status dot + title */}
        <div className="flex items-center gap-0.5 min-w-0">
          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", STATUS_DOT[job.status] ?? "bg-gray-400")} />
          <span className="text-[9px] font-semibold text-foreground truncate leading-tight">{job.title}</span>
        </div>
        {/* Row 2: time range (only if there's vertical room) */}
        {layout.heightPct > 45 && (
          <span className="text-[8px] text-muted-foreground/70 truncate leading-tight pl-2">{label}</span>
        )}
      </div>

      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 w-1.5 h-full cursor-ew-resize z-10
                   opacity-0 group-hover/card:opacity-100 hover:bg-white/25
                   transition-opacity duration-100 rounded-l-[3px]"
        onMouseDown={e => startResize(e, "left")}
      />
      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 w-1.5 h-full cursor-ew-resize z-10
                   opacity-0 group-hover/card:opacity-100 hover:bg-white/25
                   transition-opacity duration-100 rounded-r-[3px]"
        onMouseDown={e => startResize(e, "right")}
      />
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

interface DayCellProps {
  dayStr:       string;
  technicianId: number | null;
  jobs:         Job[];
  techColor:    string;
  isToday:      boolean;
  /** Pre-computed current-time %, or -1 when outside the visible range. */
  nowPct:       number;
  drag:         DragAndDropHandlers;
  resize:       DayCellResizeHandlers;
  onJobClick:   (e: React.MouseEvent, job: Job) => void;
  onAddJob:     (technicianId: number | null) => void;
}

export const DayCell = memo(function DayCell({
  dayStr,
  technicianId,
  jobs,
  techColor,
  isToday,
  nowPct,
  drag,
  resize,
  onJobClick,
  onAddJob,
}: DayCellProps) {
  const cellRef    = useRef<HTMLDivElement>(null);
  const baseTarget: DropTarget = { dayStr, technicianId };
  const isOver     = drag.isDragOver(baseTarget);

  // ── Drag preview (ghost + time label) ─────────────────────────────────────
  // State updates only on snap change → at most 28 updates across the full range
  const [previewMin, setPreviewMin] = useState<number | null>(null);
  const lastSnapRef = useRef<number | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    drag.onDragOver(e, baseTarget);
    const rect = cellRef.current?.getBoundingClientRect();
    if (!rect) return;
    const snapped = getTimeFromPosition(e.clientX - rect.left, rect.width);
    if (snapped !== lastSnapRef.current) {
      lastSnapRef.current = snapped;
      setPreviewMin(snapped);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayStr, technicianId, drag]);

  const handleDragLeave = useCallback(() => {
    drag.onDragLeave();
    setPreviewMin(null);
    lastSnapRef.current = null;
  }, [drag]);

  // ── Drop: capture X position for time derivation ──────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setPreviewMin(null);
    lastSnapRef.current = null;
    const rect  = cellRef.current?.getBoundingClientRect();
    const cellW = rect?.width ?? 1;
    const x     = rect ? e.clientX - rect.left : 0;
    drag.onDrop(e, {
      ...baseTarget,
      dropOffsetX: Math.max(0, Math.min(cellW, x)),
      cellWidth:   cellW,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayStr, technicianId, drag]);

  // ── Layout ────────────────────────────────────────────────────────────────
  const jobsWithLayout = resolveOverlaps(jobs);
  const cellWidth      = cellRef.current?.getBoundingClientRect().width ?? 160;

  // Preview ghost position (% and label)
  const dragDurMin     = previewMin !== null && drag.dragJobId !== null
    ? (jobs.find(j => j.id === drag.dragJobId)?.estimatedDuration ?? 60)
    : null;
  const previewEndMin  = previewMin !== null && dragDurMin !== null ? previewMin + dragDurMin : null;
  const previewLeftPct = previewMin !== null
    ? Math.max(0, ((previewMin - DAY_START_H * 60) / ((DAY_END_H - DAY_START_H) * 60)) * 100)
    : null;
  const previewWidthPct = previewEndMin !== null
    ? Math.max(2.5, ((dragDurMin ?? 60) / ((DAY_END_H - DAY_START_H) * 60)) * 100)
    : null;

  return (
    <div
      className={cn(
        "relative border-r border-border last:border-r-0 group/cell overflow-hidden",
        "transition-colors duration-100",
        isToday && "bg-blue-500/[0.04]",
        isOver  && "bg-blue-50/60 dark:bg-blue-950/25",
      )}
      style={{ height: CELL_H }}
    >
      {/* ── Time-label header strip ── */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none select-none"
        style={{ height: HEADER_H }}
      >
        {LABEL_TICKS.map(({ pct, label }) => (
          <span
            key={pct}
            className="absolute top-0 text-[7px] leading-tight text-muted-foreground/40 whitespace-nowrap"
            style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* ── Timeline body ── */}
      <div
        ref={cellRef}
        className={cn(
          "absolute left-0 right-0 bottom-0 overflow-hidden",
          isOver && "ring-2 ring-inset ring-blue-400 rounded-[2px]",
        )}
        style={{ top: HEADER_H, height: BODY_H }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={handleDragLeave}
      >
        {/* Background hour grid */}
        <div className="absolute inset-0 pointer-events-none">
          {HOUR_TICKS.map(({ pct, isHour }) => (
            <div
              key={pct}
              className={cn(
                "absolute top-0 bottom-0 border-l",
                isHour ? "border-border/30" : "border-border/12",
              )}
              style={{ left: `${pct}%` }}
            />
          ))}
        </div>

        {/* Current-time line */}
        {nowPct >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-red-500/70 pointer-events-none z-10"
            style={{ left: `${nowPct}%` }}
          />
        )}

        {/* Job cards */}
        {jobsWithLayout.map(({ job, layout }) => (
          <JobCard
            key={job.id}
            job={job}
            layout={layout}
            techColor={techColor}
            isDragging={drag.dragJobId === job.id}
            dayStr={dayStr}
            drag={drag}
            resize={resize}
            cellWidth={cellWidth}
            onClick={onJobClick}
          />
        ))}

        {/* Drag preview ghost */}
        {isOver && previewLeftPct !== null && previewWidthPct !== null && (
          <>
            {/* Ghost bar */}
            <div
              className="absolute top-[2%] h-[96%] rounded-[3px] pointer-events-none z-30
                         bg-blue-400/20 border-2 border-dashed border-blue-400 border-l-2"
              style={{ left: `${previewLeftPct}%`, width: `${previewWidthPct}%`, minWidth: 40 }}
            />
            {/* Time label above the ghost */}
            {previewMin !== null && previewEndMin !== null && (
              <div
                className="absolute -top-[1px] pointer-events-none z-40
                           bg-blue-500 text-white text-[8px] font-medium
                           px-1 py-0.5 rounded-b-[3px] whitespace-nowrap leading-none"
                style={{ left: `${previewLeftPct}%` }}
              >
                {fmtRange(previewMin, previewEndMin)}
              </div>
            )}
          </>
        )}

        {/* Empty-cell drop hint */}
        {isOver && jobs.length === 0 && previewLeftPct === null && (
          <div className="absolute inset-[3px] rounded border-2 border-dashed border-blue-400
                          flex items-center justify-center pointer-events-none">
            <span className="text-[9px] text-blue-500 font-medium">Drop</span>
          </div>
        )}
      </div>

      {/* ── Add-job (+) button ── */}
      <button
        className={cn(
          "absolute bottom-0.5 right-0.5 w-4 h-4 rounded z-20",
          "bg-muted/70 text-muted-foreground flex items-center justify-center",
          "opacity-0 group-hover/cell:opacity-100",
          "hover:bg-blue-500 hover:text-white",
          "transition-all duration-100",
        )}
        onClick={e => { e.stopPropagation(); onAddJob(technicianId); }}
        tabIndex={-1}
        title={`Add job on ${dayStr}`}
      >
        <Icon icon={Plus} size={10} />
      </button>
    </div>
  );
});
