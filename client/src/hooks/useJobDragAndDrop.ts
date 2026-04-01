import { useState, useRef, useCallback } from "react";

/** Identifies a single drop zone: day + technician row */
export interface DropTarget {
  dayStr:       string;
  technicianId: number | null; // null = unassigned row
  /** Pixel offset from the left of the timeline cell canvas (set by DayCell on drop) */
  dropOffsetX?: number;
  /** Width of the timeline cell canvas in px (used to compute time from X) */
  cellWidth?:   number;
}

export interface DragAndDropHandlers {
  dragJobId: number | null;
  dragOverCell: DropTarget | null;
  onDragStart: (e: React.DragEvent, jobId: number) => void;
  onDragOver: (e: React.DragEvent, target: DropTarget) => void;
  onDrop: (e: React.DragEvent, target: DropTarget) => void;
  onDragEnd: () => void;
  onDragLeave: () => void;
  /** Returns true when this specific cell is the active drop target */
  isDragOver: (target: DropTarget) => boolean;
  /** True if pointer actually moved — prevents treating a click as a drag */
  wasDragged: () => boolean;
}

/**
 * Manages HTML5 drag-and-drop for the dispatch board.
 * Supports dropping between technician rows AND between days.
 * No JSX.
 */
export function useJobDragAndDrop(
  onDrop: (jobId: number, target: DropTarget) => void
): DragAndDropHandlers {
  const [dragJobId, setDragJobId] = useState<number | null>(null);
  const [dragOverCell, setDragOverCell] = useState<DropTarget | null>(null);
  const movedRef = useRef(false);

  const handleDragStart = (e: React.DragEvent, jobId: number) => {
    movedRef.current = false;
    setDragJobId(jobId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, target: DropTarget) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    movedRef.current = true;
    // Avoid re-render when hovering the same cell
    setDragOverCell(prev =>
      prev?.dayStr === target.dayStr && prev?.technicianId === target.technicianId
        ? prev
        : target
    );
  };

  const handleDrop = (e: React.DragEvent, target: DropTarget) => {
    e.preventDefault();
    if (dragJobId !== null && movedRef.current) {
      onDrop(dragJobId, target);
    }
    setDragJobId(null);
    setDragOverCell(null);
    movedRef.current = false;
  };

  const handleDragEnd = () => {
    setDragJobId(null);
    setDragOverCell(null);
    movedRef.current = false;
  };

  const isDragOver = useCallback(
    (target: DropTarget) =>
      dragOverCell !== null &&
      dragOverCell.dayStr === target.dayStr &&
      dragOverCell.technicianId === target.technicianId,
    [dragOverCell]
  );

  return {
    dragJobId,
    dragOverCell,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    onDragEnd: handleDragEnd,
    onDragLeave: () => setDragOverCell(null),
    isDragOver,
    wasDragged: () => movedRef.current,
  };
}
