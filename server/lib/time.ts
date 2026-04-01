/**
 * Server-side timezone utilities — all dates use America/Chicago.
 */
export const TZ = "America/Chicago";

/** Today's date string in CT: "2026-03-16" */
export function todayStrCT(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Date string in CT for any Date object: "2026-03-16" */
export function dateStrCT(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

/**
 * Returns [start, end) UTC Date boundaries for a given CT date string.
 * Handles DST automatically via Intl.
 *
 * Example (CDT = UTC-5): "2026-03-16" → start = 2026-03-16T05:00Z, end = 2026-03-17T05:00Z
 * Example (CST = UTC-6): "2026-01-15" → start = 2026-01-15T06:00Z, end = 2026-01-16T06:00Z
 */
export function dayBoundsCT(ctDateStr?: string): { start: Date; end: Date } {
  const dateStr = ctDateStr ?? todayStrCT();
  const [y, mo, d] = dateStr.split("-").map(Number);

  // Use 18:00 UTC as a stable reference — safely within the day in both CST/CDT
  const refUTC = new Date(Date.UTC(y, mo - 1, d, 18, 0, 0));

  // What CT hour is 18:00 UTC? e.g. 13 for CDT (UTC-5), 12 for CST (UTC-6)
  const ctHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).format(refUTC)
  );

  // offset = ctHour - 18  →  -5 for CDT, -6 for CST
  const offsetHours = ctHour - 18;

  // midnight CT in UTC = date at hour (-offset)
  const start = new Date(Date.UTC(y, mo - 1, d, -offsetHours, 0, 0));
  const end   = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Start of the week (Mon–Sun) containing the given CT date string (or today). */
export function weekBoundsCT(anchorDateStr?: string): { start: Date; end: Date; dayStrings: string[] } {
  const todayStr = anchorDateStr ?? todayStrCT();
  const [y, mo, d] = todayStr.split("-").map(Number);

  // Use noon UTC of "today" date to determine day-of-week
  const noonUTC = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const dow = noonUTC.getUTCDay(); // 0=Sun … 6=Sat
  const mondayOffset = (dow + 6) % 7;

  const dayStrings: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(noonUTC.getTime() + (i - mondayOffset) * 86_400_000);
    dayStrings.push(new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(dt));
  }

  const { start } = dayBoundsCT(dayStrings[0]);
  const { end }   = dayBoundsCT(dayStrings[6]);
  return { start, end, dayStrings };
}

/** Start of the current month in CT, as a UTC Date */
export function monthStartCT(): Date {
  const todayStr = todayStrCT(); // "2026-03-16"
  const [y, mo]  = todayStr.split("-").map(Number);
  return dayBoundsCT(`${y}-${String(mo).padStart(2, "0")}-01`).start;
}
