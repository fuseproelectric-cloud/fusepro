import type { Job } from "@shared/schema";
import { dayBoundsCT, dateStrCT } from "@/lib/time";

// ── Constants ─────────────────────────────────────────────────────────────────
export const TIMELINE_START_HOUR = 6;        // 6:00 AM
export const TIMELINE_END_HOUR   = 21;        // 9:00 PM
export const SLOT_MINUTES        = 30;        // granularity
export const SLOT_WIDTH_PX       = 72;        // pixels per 30-min slot
export const ROW_HEIGHT_PX       = 88;        // pixels per technician row
export const TECH_COL_WIDTH      = 144;       // pixels for sticky left column

export const TOTAL_SLOTS =
  ((TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60) / SLOT_MINUTES;
export const TOTAL_TIMELINE_WIDTH = TOTAL_SLOTS * SLOT_WIDTH_PX;

// ── Time slots for the header ruler ──────────────────────────────────────────
export interface TimeSlot {
  index: number;
  hour: number;
  minute: number;
  isHour: boolean;
  label: string;  // "6 AM", "6:30", …
}

export function getTimeSlots(): TimeSlot[] {
  return Array.from({ length: TOTAL_SLOTS }, (_, i) => {
    const totalMin = TIMELINE_START_HOUR * 60 + i * SLOT_MINUTES;
    const hour   = Math.floor(totalMin / 60);
    const minute = totalMin % 60;
    const isHour = minute === 0;
    const label  = isHour
      ? new Intl.DateTimeFormat("en-US", {
          hour: "numeric", hour12: true,
        }).format(new Date(2000, 0, 1, hour, 0))
      : `${String(minute).padStart(2, "0")}`;
    return { index: i, hour, minute, isHour, label };
  });
}

// ── Timezone-aware CT hours/minutes ─────────────────────────────────────────
function getCTMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour:   "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parseInt(parts.find(p => p.type === "hour")?.value   ?? "0", 10);
  const m = parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10);
  // Handle midnight edge case where hour = 24
  return (h === 24 ? 0 : h) * 60 + m;
}

/** Minutes from timeline start (6:00 AM CT) for a given UTC date */
export function minutesFromStart(d: Date): number {
  const totalMin  = getCTMinutes(d);
  const startMin  = TIMELINE_START_HOUR * 60;
  return Math.max(0, totalMin - startMin);
}

/** UTC Date → left offset in pixels on the timeline canvas */
export function timeToLeftPx(d: Date): number {
  return (minutesFromStart(d) / SLOT_MINUTES) * SLOT_WIDTH_PX;
}

/** Duration minutes → width in pixels (minimum = half a slot) */
export function durationToWidthPx(minutes: number): number {
  return Math.max(SLOT_WIDTH_PX * 0.5, (minutes / SLOT_MINUTES) * SLOT_WIDTH_PX);
}

/** Snap raw minutes to the nearest SLOT_MINUTES boundary */
export function snapMinutes(minutes: number): number {
  return Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES;
}

/**
 * Convert a pixel offset on the canvas to a UTC Date on the given day.
 * Uses dayBoundsCT so the result respects DST.
 */
export function leftPxToTime(px: number, dayDate: Date): Date {
  const rawMinutes    = TIMELINE_START_HOUR * 60 + (px / SLOT_WIDTH_PX) * SLOT_MINUTES;
  const snapped       = Math.max(
    TIMELINE_START_HOUR * 60,
    Math.min(TIMELINE_END_HOUR * 60 - SLOT_MINUTES, snapMinutes(rawMinutes))
  );
  const { start: midnightCT } = dayBoundsCT(dateStrCT(dayDate));
  return new Date(midnightCT.getTime() + snapped * 60 * 1000);
}

/** Left px for the current time indicator (-1 if outside the visible range) */
export function currentTimeLeftPx(): number {
  const now    = new Date();
  const ctMin  = getCTMinutes(now);
  const start  = TIMELINE_START_HOUR * 60;
  const end    = TIMELINE_END_HOUR   * 60;
  if (ctMin < start || ctMin > end) return -1;
  return ((ctMin - start) / SLOT_MINUTES) * SLOT_WIDTH_PX;
}

// ── Overlap-aware layout ─────────────────────────────────────────────────────
export interface JobLayout {
  left:        number;
  width:       number;
  top:         number;
  height:      number;
  column:      number;
  columnCount: number;
}

export interface JobWithLayout {
  job:    Job;
  layout: JobLayout;
}

/**
 * Assigns each job a column so overlapping jobs don't fully occlude each other.
 * Jobs in the same visual column are stacked vertically.
 */
export function computeJobLayouts(
  jobs: Job[],
  rowHeight: number = ROW_HEIGHT_PX
): JobWithLayout[] {
  if (jobs.length === 0) return [];

  const sorted = [...jobs].sort((a, b) => {
    const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return at - bt;
  });

  // Greedy column packing: column = earliest column whose last job ended
  const colEnds: number[] = [];
  const jobCols: number[] = [];

  for (const job of sorted) {
    const startMs = job.scheduledAt ? new Date(job.scheduledAt).getTime() : 0;
    const dur     = (job.estimatedDuration ?? 60) * 60_000;
    const endMs   = startMs + dur;

    let col = colEnds.findIndex(end => end <= startMs);
    if (col === -1) col = colEnds.length;
    colEnds[col] = endMs;
    jobCols.push(col);
  }

  const maxCols   = colEnds.length;
  const cellH     = Math.max(24, Math.floor((rowHeight - 2) / maxCols));

  return sorted.map((job, i) => ({
    job,
    layout: {
      left:        job.scheduledAt ? timeToLeftPx(new Date(job.scheduledAt)) : 0,
      width:       durationToWidthPx(job.estimatedDuration ?? 60),
      top:         jobCols[i] * cellH,
      height:      cellH - 2,
      column:      jobCols[i],
      columnCount: maxCols,
    },
  }));
}
