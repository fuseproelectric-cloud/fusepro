import { useRef, useState, useCallback } from "react";
import type { Job } from "@shared/schema";
import type { TechTimelineRow } from "./useTimelineLayout";
import {
  SLOT_WIDTH_PX, SLOT_MINUTES, ROW_HEIGHT_PX, TECH_COL_WIDTH,
  leftPxToTime, durationToWidthPx, snapMinutes, TIMELINE_START_HOUR,
} from "@/lib/schedule/timeline-utils";

export interface DragPreview {
  jobId:    number;
  techId:   number | null;
  left:     number;   // canvas-relative px
  top:      number;   // canvas-relative px (row index * ROW_HEIGHT)
  width:    number;
  rowIndex: number;
}

interface DragInternalState {
  jobId:          number;
  job:            Job;
  originClientX:  number;
  originClientY:  number;
  /** Canvas px where the job started */
  originLeft:     number;
  originRowIndex: number;
  width:          number;
  rafId:          number;
}

interface UseDragToTimeOptions {
  /** Ref to the scrollable outer container (used to read scrollLeft / scrollTop) */
  scrollRef:  React.RefObject<HTMLElement | null>;
  techRows:   TechTimelineRow[];
  selectedDay: Date;
  onCommit:   (jobId: number, newTechId: number | null, newStartTime: Date) => void;
}

export interface DragToTimeHandlers {
  dragJobId:   number | null;
  dragPreview: DragPreview | null;
  startDrag:   (e: React.MouseEvent, job: Job, rowIndex: number) => void;
}

export function useDragToTime({
  scrollRef,
  techRows,
  selectedDay,
  onCommit,
}: UseDragToTimeOptions): DragToTimeHandlers {
  const internalRef    = useRef<DragInternalState | null>(null);
  const [dragJobId,   setDragJobId]   = useState<number | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  // Declared before startDrag so the onMouseUp closure captures it correctly
  const dragPreviewRef = useRef<DragPreview | null>(null);

  const startDrag = useCallback(
    (e: React.MouseEvent, job: Job, rowIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      const duration  = job.estimatedDuration ?? 60;
      const originLeft = job.scheduledAt
        ? ((Math.max(0, new Intl.DateTimeFormat("en-US", {
              timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hour12: false,
            }).formatToParts(new Date(job.scheduledAt)).reduce((acc, p) => {
              if (p.type === "hour")   return acc + (parseInt(p.value) === 24 ? 0 : parseInt(p.value)) * 60;
              if (p.type === "minute") return acc + parseInt(p.value);
              return acc;
            }, 0) - TIMELINE_START_HOUR * 60)) / SLOT_MINUTES) * SLOT_WIDTH_PX
        : 0;

      internalRef.current = {
        jobId:          job.id,
        job,
        originClientX:  e.clientX,
        originClientY:  e.clientY,
        originLeft,
        originRowIndex: rowIndex,
        width:          durationToWidthPx(duration),
        rafId:          0,
      };

      setDragJobId(job.id);
      setDragPreview({
        jobId:    job.id,
        techId:   job.technicianId ?? null,
        left:     originLeft,
        top:      rowIndex * ROW_HEIGHT_PX,
        width:    durationToWidthPx(duration),
        rowIndex,
      });

      const onMouseMove = (ev: MouseEvent) => {
        const state = internalRef.current;
        if (!state) return;

        cancelAnimationFrame(state.rafId);
        state.rafId = requestAnimationFrame(() => {
          const s = internalRef.current;
          if (!s) return;

          const scrollEl  = scrollRef.current;
          const scrollX   = scrollEl?.scrollLeft ?? 0;
          const scrollY   = scrollEl?.scrollTop  ?? 0;

          // Delta from drag start
          const dx = ev.clientX - s.originClientX;
          const dy = ev.clientY - s.originClientY;

          // New canvas-relative left (snapped)
          const rawLeft     = Math.max(0, s.originLeft + dx);
          const rawMinutes  = TIMELINE_START_HOUR * 60 + (rawLeft / SLOT_WIDTH_PX) * SLOT_MINUTES;
          const snappedMin  = snapMinutes(rawMinutes) - TIMELINE_START_HOUR * 60;
          const snappedLeft = Math.max(0, (snappedMin / SLOT_MINUTES) * SLOT_WIDTH_PX);

          // New row index from absolute Y (accounting for header and scroll)
          const timelineHeaderH = 40; // px — matches TimelineHeader height
          const techColW        = TECH_COL_WIDTH;
          // canvas top = container top + headerH - scrollY
          const absCanvasTop = (scrollEl?.getBoundingClientRect().top ?? 0) + timelineHeaderH - scrollY;
          const relY         = ev.clientY - absCanvasTop;
          const newRowIndex  = Math.max(0, Math.min(
            techRows.length - 1,
            Math.floor(relY / ROW_HEIGHT_PX)
          ));

          setDragPreview({
            jobId:    s.jobId,
            techId:   techRows[newRowIndex]?.technicianId ?? null,
            left:     snappedLeft,
            top:      newRowIndex * ROW_HEIGHT_PX,
            width:    s.width,
            rowIndex: newRowIndex,
          });
        });
      };

      const onMouseUp = (ev: MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        cancelAnimationFrame(internalRef.current?.rafId ?? 0);

        const state    = internalRef.current;
        const preview  = dragPreviewRef.current;
        internalRef.current = null;

        setDragJobId(null);
        setDragPreview(null);

        if (!state || !preview) return;

        const newStart = leftPxToTime(preview.left, selectedDay);
        const newTech  = preview.techId;
        onCommit(state.jobId, newTech, newStart);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [techRows, selectedDay, onCommit, scrollRef]
  );

  // Keep ref in sync with the latest dragPreview state so onMouseUp can read it
  dragPreviewRef.current = dragPreview;

  return { dragJobId, dragPreview, startDrag };
}
