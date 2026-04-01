import { useRef } from "react";
import {
  SLOT_WIDTH_PX, SLOT_MINUTES, TIMELINE_START_HOUR,
  snapMinutes, leftPxToTime, durationToWidthPx,
} from "@/lib/schedule/timeline-utils";

type ResizeHandle = "left" | "right";

interface ResizeState {
  jobId:          number;
  handle:         ResizeHandle;
  startClientX:   number;
  origLeft:       number;
  origWidth:      number;
  origScheduledAt: string;
  origDuration:   number;
  elem:           HTMLElement;
}

interface UseResizeJobOptions {
  selectedDay: Date;
  onCommit: (jobId: number, newDurationMin: number, newStartTime?: Date) => void;
}

export interface UseResizeJobReturn {
  onResizeStart: (
    e:               React.MouseEvent,
    jobId:           number,
    handle:          ResizeHandle,
    elem:            HTMLElement,
    origLeft:        number,
    origWidth:       number,
    origScheduledAt: string,
    origDuration:    number
  ) => void;
}

/**
 * Resize jobs by dragging left/right handles.
 * Manipulates DOM directly during drag (no React state) for zero re-renders.
 * Commits to React only on mouseup.
 */
export function useResizeJob({ selectedDay, onCommit }: UseResizeJobOptions) {
  const stateRef = useRef<ResizeState | null>(null);

  const onResizeStart = (
    e: React.MouseEvent,
    jobId:           number,
    handle:          ResizeHandle,
    elem:            HTMLElement,
    origLeft:        number,
    origWidth:       number,
    origScheduledAt: string,
    origDuration:    number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    stateRef.current = {
      jobId, handle, elem,
      startClientX:    e.clientX,
      origLeft,  origWidth,
      origScheduledAt, origDuration,
    };

    // Disable pointer events on the card body during resize
    elem.style.pointerEvents = "none";
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const dx = ev.clientX - s.startClientX;

      if (s.handle === "right") {
        const newW = Math.max(SLOT_WIDTH_PX * 0.5, s.origWidth + dx);
        s.elem.style.width = `${newW}px`;
      } else {
        const maxDelta  = s.origWidth - SLOT_WIDTH_PX * 0.5;
        const clampedDx = Math.min(maxDelta, dx);
        const newLeft   = s.origLeft + clampedDx;
        const newW      = s.origWidth - clampedDx;
        s.elem.style.left  = `${newLeft}px`;
        s.elem.style.width = `${newW}px`;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);

      const s = stateRef.current;
      stateRef.current = null;
      if (!s) return;

      s.elem.style.pointerEvents = "";
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";

      const dx = ev.clientX - s.startClientX;

      if (s.handle === "right") {
        const newWidthPx  = Math.max(SLOT_WIDTH_PX * 0.5, s.origWidth + dx);
        const rawMin      = (newWidthPx / SLOT_WIDTH_PX) * SLOT_MINUTES;
        const snapped     = Math.max(SLOT_MINUTES, snapMinutes(rawMin));
        onCommit(s.jobId, snapped);
      } else {
        const maxDelta    = s.origWidth - SLOT_WIDTH_PX * 0.5;
        const clampedDx   = Math.min(maxDelta, dx);
        const newLeft     = s.origLeft + clampedDx;
        const deltaMin    = (clampedDx / SLOT_WIDTH_PX) * SLOT_MINUTES;
        const snappedDelta = snapMinutes(deltaMin);

        const newStart   = leftPxToTime(newLeft, selectedDay);
        const newDuration = Math.max(SLOT_MINUTES, s.origDuration - snappedDelta);
        onCommit(s.jobId, newDuration, newStart);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",   onMouseUp);
  };

  return { onResizeStart };
}
