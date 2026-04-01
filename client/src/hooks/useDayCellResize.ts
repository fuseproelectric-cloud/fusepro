/**
 * useDayCellResize
 *
 * Resize jobs in the week-view DayCell by dragging left/right handles.
 * Manipulates DOM directly during drag (zero React re-renders).
 * Commits via onCommit only on mouseup.
 *
 * dayStr is passed per-call (not at hook creation) so a single hook instance
 * works across all 7 DayCells in the week grid.
 */

import { useRef } from "react";
import { fromCTDayAndMinutes, snapMinutes } from "@/lib/schedule/ct-time";
import { DAY_START_H, DAY_END_H, SNAP_MIN } from "@/lib/schedule/timeline-layout";

const DAY_START_MIN = DAY_START_H * 60;
const DAY_END_MIN   = DAY_END_H   * 60;
const TOTAL_MIN     = DAY_END_MIN - DAY_START_MIN;

interface ResizeState {
  jobId:        number;
  dayStr:       string;
  handle:       "left" | "right";
  startClientX: number;
  cellWidth:    number;
  origStartMin: number;
  origEndMin:   number;
  elem:         HTMLElement;
}

interface UseDayCellResizeOptions {
  onCommit: (jobId: number, scheduledAt: string, durationMin: number) => void;
}

export interface DayCellResizeHandlers {
  onResizeStart: (
    e:         React.MouseEvent,
    jobId:     number,
    handle:    "left" | "right",
    elem:      HTMLElement,
    cellWidth: number,
    startMin:  number,
    endMin:    number,
    dayStr:    string,
  ) => void;
}

export function useDayCellResize({
  onCommit,
}: UseDayCellResizeOptions): DayCellResizeHandlers {
  const stateRef = useRef<ResizeState | null>(null);

  const onResizeStart = (
    e:         React.MouseEvent,
    jobId:     number,
    handle:    "left" | "right",
    elem:      HTMLElement,
    cellWidth: number,
    startMin:  number,
    endMin:    number,
    dayStr:    string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    stateRef.current = {
      jobId, dayStr, handle, elem, cellWidth,
      startClientX: e.clientX,
      origStartMin: startMin,
      origEndMin:   endMin,
    };

    elem.style.pointerEvents    = "none";
    document.body.style.cursor  = "ew-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const dx       = ev.clientX - s.startClientX;
      const deltaMin = snapMinutes((dx / s.cellWidth) * TOTAL_MIN, SNAP_MIN);

      if (s.handle === "right") {
        const newEnd      = Math.max(s.origStartMin + SNAP_MIN, Math.min(DAY_END_MIN, s.origEndMin + deltaMin));
        const newWidthPct = ((newEnd - s.origStartMin) / TOTAL_MIN) * 100;
        s.elem.style.width = `${Math.max(0.5, newWidthPct)}%`;
      } else {
        const newStart    = Math.max(DAY_START_MIN, Math.min(s.origEndMin - SNAP_MIN, s.origStartMin + deltaMin));
        const newLeftPct  = ((newStart - DAY_START_MIN) / TOTAL_MIN) * 100;
        const newWidthPct = ((s.origEndMin - newStart) / TOTAL_MIN) * 100;
        s.elem.style.left  = `${Math.max(0, newLeftPct)}%`;
        s.elem.style.width = `${Math.max(0.5, newWidthPct)}%`;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);

      const s = stateRef.current;
      stateRef.current = null;
      if (!s) return;

      s.elem.style.pointerEvents     = "";
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";

      const dx       = ev.clientX - s.startClientX;
      const deltaMin = snapMinutes((dx / s.cellWidth) * TOTAL_MIN, SNAP_MIN);

      let newStartMin: number;
      let newDuration: number;

      if (s.handle === "right") {
        newStartMin = s.origStartMin;
        const newEnd = Math.max(s.origStartMin + SNAP_MIN, Math.min(DAY_END_MIN, s.origEndMin + deltaMin));
        newDuration  = newEnd - newStartMin;
      } else {
        newStartMin = Math.max(DAY_START_MIN, Math.min(s.origEndMin - SNAP_MIN, s.origStartMin + deltaMin));
        newDuration  = s.origEndMin - newStartMin;
      }

      const scheduledAt = fromCTDayAndMinutes(s.dayStr, newStartMin).toISOString();
      onCommit(s.jobId, scheduledAt, Math.max(SNAP_MIN, newDuration));
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
  };

  return { onResizeStart };
}
