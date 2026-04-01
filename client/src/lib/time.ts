/**
 * All time display uses America/Chicago timezone.
 */
export const TZ = "America/Chicago";

const fmt = (d: Date | string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(
    typeof d === "string" ? new Date(d) : d
  );

/** "9:30 AM" */
export const fmtTime = (d: Date | string) =>
  fmt(d, { hour: "numeric", minute: "2-digit", hour12: true });

/** "9:30:45 AM" — for live clocks */
export const fmtClock = (d: Date) =>
  fmt(d, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });

/** "Mon" */
export const fmtDayAbbr = (d: Date | string) =>
  fmt(d, { weekday: "short" });

/** "Monday, March 16, 2026" */
export const fmtDateFull = (d: Date | string) =>
  fmt(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

/** "Monday, Mar 16, 2026" */
export const fmtDateMed = (d: Date | string) =>
  fmt(d, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

/** "Monday, Mar 16 at 9:30 AM" */
export const fmtScheduledAt = (d: Date | string) =>
  fmt(d, { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

/** "Mar 16 at 9:30 AM" */
export const fmtCompletedAt = (d: Date | string) =>
  fmt(d, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

/** "Mar 16, 9:30 AM" — for notes / log entries */
export const fmtNoteTime = (d: Date | string) =>
  fmt(d, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

/** "9:30 AM" alias */
export const fmtTimeShort = fmtTime;

/**
 * Today's date string in CT: "2026-03-16"
 * Use for "is this today?" checks.
 */
export const todayStrCT = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

/**
 * Date string for any date in CT: "2026-03-16"
 */
export const dateStrCT = (d: Date | string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
    typeof d === "string" ? new Date(d) : d
  );

/**
 * Returns true if a date falls on today in CT.
 */
export const isTodayCT = (d: Date | string): boolean =>
  dateStrCT(d) === todayStrCT();

/**
 * Start-of-day and end-of-day boundaries in UTC for a given CT date string.
 * Handles DST correctly via Intl.
 */
export function dayBoundsCT(ctDateStr?: string): { start: Date; end: Date } {
  const dateStr = ctDateStr ?? todayStrCT(); // "YYYY-MM-DD"

  // Find midnight CT by binary-searching the UTC offset
  // Simpler: use Date.parse on a UTC-noon approximation then shift
  const [y, mo, d] = dateStr.split("-").map(Number);

  // Noon UTC on that calendar date
  const noonUTC = new Date(Date.UTC(y, mo - 1, d, 18, 0, 0));

  // What CT hour is "noon UTC"? Get the offset
  const ctHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(noonUTC)
  );
  // offset = ctHour - 18 (e.g. -6 for CST, -5 for CDT)
  const offsetHours = ctHour - 18;

  // Midnight CT = midnight UTC + |offset| hours
  const start = new Date(Date.UTC(y, mo - 1, d, -offsetHours, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Returns the Mon-Sun week boundaries for the current week in CT.
 */
export function weekBoundsCT(): { start: Date; end: Date; days: string[] } {
  const todayStr = todayStrCT();
  const [y, mo, d] = todayStr.split("-").map(Number);
  const todayDate = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const dow = todayDate.getUTCDay(); // 0=Sun … 6=Sat
  const mondayOffset = (dow + 6) % 7; // days since Monday

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d2 = new Date(todayDate.getTime() + (i - mondayOffset) * 86400000);
    days.push(
      new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d2)
    );
  }
  const { start } = dayBoundsCT(days[0]);
  const { end } = dayBoundsCT(days[6]);
  return { start, end, days };
}
