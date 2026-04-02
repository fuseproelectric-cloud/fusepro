/**
 * Timesheets Domain Service
 *
 * Owns all timesheet calculation and aggregation logic:
 *   - interval (work/travel) minute accumulation
 *   - technician current-status derivation
 *   - earnings computation with per-day snapshot-rate support
 *
 * All functions are pure (no DB calls). Storage fetches raw rows and delegates
 * aggregation here. Routes may also call calcIntervalMinutes directly for
 * day/week view breakdowns.
 */

import type { Timesheet } from "@shared/schema";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface TechnicianCurrentStatus {
  isDayStarted: boolean;
  isOnBreak: boolean;
  activeJobId: number | null;
  dayStartTime: Date | null;
  totalWorkMinutesToday: number;
  totalTravelMinutesToday: number;
}

/** A single earnings row as returned by the DB join. */
export interface EarningsRow {
  ts: Timesheet;
  jobTitle: string | null;
}

export type ApprovalsMap = Record<string, {
  approvedBy: number;
  approvedAt: Date;
  snapshotRate: string | null;
}>;

export interface EarningsResult {
  totalWorkMinutes: number;
  totalTravelMinutes: number;
  totalEarnings: number;
  jobs: Array<{
    jobId: number | null;
    jobTitle: string;
    workMinutes: number;
    travelMinutes: number;
    earnings: number;
    date: string;
  }>;
  daily: Array<{
    date: string;
    workMinutes: number;
    travelMinutes: number;
    earnings: number;
  }>;
}

// ─── Core interval helper ─────────────────────────────────────────────────────

/**
 * Accumulates minutes from paired start/end entries in a chronologically
 * sorted list. If an interval is still open when the list ends, it is capped
 * against `capTime` (when provided), matching the "live" behaviour used in
 * today/week views.
 */
export function calcIntervalMinutes(
  entries: ReadonlyArray<{ entryType: string; timestamp: Date | string }>,
  startType: string,
  endType: string,
  capTime?: Date,
): number {
  let minutes = 0;
  let openStart: Date | null = null;
  for (const e of entries) {
    if (e.entryType === startType) {
      openStart = new Date(e.timestamp);
    } else if (e.entryType === endType && openStart) {
      minutes += Math.floor((new Date(e.timestamp).getTime() - openStart.getTime()) / 60000);
      openStart = null;
    }
  }
  if (openStart && capTime) {
    minutes += Math.floor((capTime.getTime() - openStart.getTime()) / 60000);
  }
  return minutes;
}

// ─── Technician current status ────────────────────────────────────────────────

/**
 * Derives the technician's live status from today's timesheet entries.
 * Entries do not need to be pre-sorted; this function sorts internally.
 */
export function computeCurrentStatus(
  entries: ReadonlyArray<Timesheet & { jobTitle?: string | null }>,
): TechnicianCurrentStatus {
  const dayStarts = entries.filter((e) => e.entryType === "day_start");
  const dayEnds   = entries.filter((e) => e.entryType === "day_end");
  const isDayStarted = dayStarts.length > dayEnds.length;
  const dayStartEntry = dayStarts.length > 0 ? dayStarts[dayStarts.length - 1] : null;

  const breakStarts = entries.filter((e) => e.entryType === "break_start");
  const breakEnds   = entries.filter((e) => e.entryType === "break_end");
  const isOnBreak = breakStarts.length > breakEnds.length;

  // Active job: last work_start without a matching work_end after it
  const workStarts = entries.filter((e) => e.entryType === "work_start");
  const workEnds   = entries.filter((e) => e.entryType === "work_end");
  const lastWorkStart = workStarts.length > 0 ? workStarts[workStarts.length - 1] : null;
  const lastWorkEnd   = workEnds.length   > 0 ? workEnds[workEnds.length - 1]     : null;
  const isCurrentlyWorking =
    lastWorkStart !== null &&
    (lastWorkEnd === null ||
      new Date(lastWorkStart.timestamp).getTime() > new Date(lastWorkEnd.timestamp).getTime());
  const activeJobId = isCurrentlyWorking && lastWorkStart ? (lastWorkStart.jobId ?? null) : null;

  const now = new Date();
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const totalWorkMinutesToday   = calcIntervalMinutes(sorted, "work_start",   "work_end",   now);
  const totalTravelMinutesToday = calcIntervalMinutes(sorted, "travel_start", "travel_end", now);

  return {
    isDayStarted,
    isOnBreak,
    activeJobId,
    dayStartTime: dayStartEntry ? new Date(dayStartEntry.timestamp) : null,
    totalWorkMinutesToday,
    totalTravelMinutesToday,
  };
}

// ─── Earnings computation ─────────────────────────────────────────────────────

/**
 * Computes job-level and daily earnings from raw DB rows plus rate context.
 *
 * Approved days use the frozen `snapshotRate`; unapproved days use
 * `currentRate`. This is the only correct approach when rates differ per day.
 */
export function computeEarnings(
  rows: EarningsRow[],
  currentRate: number,
  approvalsMap: ApprovalsMap,
): EarningsResult {
  const rateFor = (date: string): number => {
    const appr = approvalsMap[date];
    if (appr?.snapshotRate != null) return Number(appr.snapshotRate);
    return currentRate;
  };

  // Group entries by job (or by day for non-job entries)
  const jobMap = new Map<string, {
    jobId: number | null;
    jobTitle: string;
    entries: EarningsRow[];
    date: string;
  }>();
  for (const row of rows) {
    const key = row.ts.jobId != null
      ? `job-${row.ts.jobId}`
      : `day-${row.ts.timestamp.toISOString().slice(0, 10)}`;
    if (!jobMap.has(key)) {
      jobMap.set(key, {
        jobId: row.ts.jobId,
        jobTitle: row.jobTitle ?? (row.ts.jobId ? `Job #${row.ts.jobId}` : "General"),
        entries: [],
        date: row.ts.timestamp.toISOString().slice(0, 10),
      });
    }
    jobMap.get(key)!.entries.push(row);
  }

  const calcMins = (groupRows: EarningsRow[]) => ({
    workMins:   calcIntervalMinutes(groupRows.map((r) => r.ts), "work_start",   "work_end"),
    travelMins: calcIntervalMinutes(groupRows.map((r) => r.ts), "travel_start", "travel_end"),
  });

  const jobs = [...jobMap.values()]
    .filter((g) => g.jobId != null)
    .map((g) => {
      const { workMins, travelMins } = calcMins(g.entries);
      return {
        jobId:        g.jobId,
        jobTitle:     g.jobTitle,
        workMinutes:  workMins,
        travelMinutes: travelMins,
        earnings:     Math.round((workMins / 60) * rateFor(g.date) * 100) / 100,
        date:         g.date,
      };
    })
    .filter((j) => j.workMinutes > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Daily breakdown — each day may use a different effective rate
  const dailyMap = new Map<string, { workMins: number; travelMins: number }>();
  for (const row of rows) {
    const d = row.ts.timestamp.toISOString().slice(0, 10);
    if (!dailyMap.has(d)) dailyMap.set(d, { workMins: 0, travelMins: 0 });
  }
  for (const [date] of dailyMap) {
    const dayRows = rows.filter((r) => r.ts.timestamp.toISOString().slice(0, 10) === date);
    dailyMap.set(date, calcMins(dayRows));
  }

  const daily = [...dailyMap.entries()]
    .map(([date, { workMins, travelMins }]) => ({
      date,
      workMinutes:   workMins,
      travelMinutes: travelMins,
      earnings:      Math.round((workMins / 60) * rateFor(date) * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalWorkMinutes   = daily.reduce((s, d) => s + d.workMinutes,   0);
  const totalTravelMinutes = daily.reduce((s, d) => s + d.travelMinutes, 0);
  // Sum per-day earnings (each may use a different rate) — never multiply totalMins by one rate.
  const totalEarnings = Math.round(daily.reduce((s, d) => s + d.earnings, 0) * 100) / 100;

  return { totalWorkMinutes, totalTravelMinutes, totalEarnings, jobs, daily };
}

export const timesheetsDomainService = { computeCurrentStatus, computeEarnings, calcIntervalMinutes };
