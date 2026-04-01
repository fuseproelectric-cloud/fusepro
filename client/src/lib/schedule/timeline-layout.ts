/**
 * timeline-layout.ts
 *
 * Pure layout engine for the week-view DayCell mini-timeline.
 * Returns percentage-based values — cells can be any width.
 *
 * All time math delegates to ct-time.ts.
 */

import type { Job } from "@shared/schema";
import { toCTMinutes, fromCTDayAndMinutes, snapMinutes } from "./ct-time";

// ── Day-range config ──────────────────────────────────────────────────────────
export const DAY_START_H  = 6;   // 06:00 CT
export const DAY_END_H    = 20;  // 20:00 CT
export const SNAP_MIN     = 30;  // drag/drop snap granularity
export const MIN_WIDTH_PCT = 2.5; // minimum visible job width

const DAY_START_MIN = DAY_START_H * 60;
const DAY_END_MIN   = DAY_END_H   * 60;
const TOTAL_MIN     = DAY_END_MIN - DAY_START_MIN; // 840

// ── Types ─────────────────────────────────────────────────────────────────────

/** All values are percentages relative to the DayCell. */
export interface JobLayout {
  leftPct:   number;
  widthPct:  number;
  topPct:    number;
  heightPct: number;
  /** CT minutes since midnight for job start */
  startMin:  number;
  /** CT minutes since midnight for job end */
  endMin:    number;
}

export interface JobWithLayout {
  job:    Job;
  layout: JobLayout;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get start/end CT-minutes for a job.
 * Falls back to scheduledAt + estimatedDuration when no explicit times exist.
 */
export function getJobTimes(job: Job): { startMin: number; endMin: number; durationMin: number } {
  const startMin  = job.scheduledAt
    ? toCTMinutes(new Date(job.scheduledAt))
    : DAY_START_MIN;
  const durationMin = Math.max(SNAP_MIN, job.estimatedDuration ?? 60);
  const endMin    = startMin + durationMin;
  return { startMin, endMin, durationMin };
}

// ── Core layout ───────────────────────────────────────────────────────────────

/**
 * Compute % layout for a single job.
 * Does NOT resolve overlaps — call resolveOverlaps() for that.
 */
export function getJobLayout(job: Job): JobLayout {
  const { startMin, endMin, durationMin } = getJobTimes(job);

  // Clamp to the visible day range
  const clampedStart = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN - SNAP_MIN, startMin));
  const clampedEnd   = Math.max(clampedStart + SNAP_MIN, Math.min(DAY_END_MIN, endMin));

  const leftPct  = ((clampedStart - DAY_START_MIN) / TOTAL_MIN) * 100;
  const widthPct = Math.max(MIN_WIDTH_PCT, ((clampedEnd - clampedStart) / TOTAL_MIN) * 100);

  return {
    leftPct:   Math.min(100 - MIN_WIDTH_PCT, leftPct),
    widthPct:  Math.min(100 - leftPct, widthPct),
    topPct:    0,
    heightPct: 100,
    startMin,
    endMin,
  };
}

/**
 * Resolve overlapping jobs into non-occluding vertical lanes.
 *
 * Algorithm (greedy column packing):
 * 1. Sort by start time
 * 2. For each job, find the earliest lane whose last job has already ended
 * 3. Divide cell height equally among max concurrent lanes
 */
export function resolveOverlaps(jobs: Job[]): JobWithLayout[] {
  if (jobs.length === 0) return [];

  const sorted = [...jobs].sort((a, b) => {
    const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return at - bt;
  });

  const laneEnds: number[] = [];
  const jobLanes: number[] = [];

  for (const job of sorted) {
    const { startMin, endMin } = getJobTimes(job);
    let lane = laneEnds.findIndex(end => end <= startMin);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = endMin;
    jobLanes.push(lane);
  }

  const maxLanes  = Math.max(1, laneEnds.length);
  const lanePct   = 100 / maxLanes;
  const gapPct    = maxLanes > 1 ? 1 : 0;

  return sorted.map((job, i) => {
    const base = getJobLayout(job);
    return {
      job,
      layout: {
        ...base,
        topPct:    jobLanes[i] * lanePct,
        heightPct: lanePct - gapPct,
      },
    };
  });
}

// ── Time ↔ Position ───────────────────────────────────────────────────────────

/**
 * Pixel offset within a cell → CT minutes since midnight (snapped).
 */
export function getTimeFromPosition(x: number, cellWidth: number): number {
  const ratio  = Math.max(0, Math.min(1, x / cellWidth));
  const rawMin = DAY_START_MIN + ratio * TOTAL_MIN;
  return snapMinutes(
    Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, rawMin)),
    SNAP_MIN,
  );
}

/**
 * Pixel offset + day string → UTC Date (DST-safe via fromCTDayAndMinutes).
 */
export function getDateFromPosition(x: number, cellWidth: number, dayStr: string): Date {
  return fromCTDayAndMinutes(dayStr, getTimeFromPosition(x, cellWidth));
}

// ── Background grid ───────────────────────────────────────────────────────────

export interface HourTick {
  pct:    number;
  label:  string;
  isHour: boolean; // true = whole hour, false = half-hour
}

/**
 * Hour (and optionally half-hour) tick positions as % from the left edge.
 * Used for background grid lines and labels.
 */
export function getHourTicks(includeHalfHours = false): HourTick[] {
  const ticks: HourTick[] = [];
  const step = includeHalfHours ? 30 : 60;
  for (let min = DAY_START_MIN; min <= DAY_END_MIN; min += step) {
    const h      = Math.floor(min / 60);
    const m      = min % 60;
    const pct    = ((min - DAY_START_MIN) / TOTAL_MIN) * 100;
    const isHour = m === 0;
    const label  = isHour
      ? new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: true })
          .format(new Date(2000, 0, 1, h, 0))
          .replace(/ (AM|PM)/, (_, x) => x[0]) // "6 AM" → "6A"
      : "";
    ticks.push({ pct, label, isHour });
  }
  return ticks;
}

// ── Current-time indicator ────────────────────────────────────────────────────

/**
 * Current-time position as % within the day range.
 * Returns -1 when the current CT time is outside the visible range.
 */
export function currentTimePct(): number {
  const now    = new Date();
  const ctMin  = toCTMinutes(now);
  if (ctMin < DAY_START_MIN || ctMin > DAY_END_MIN) return -1;
  return ((ctMin - DAY_START_MIN) / TOTAL_MIN) * 100;
}
