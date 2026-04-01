/**
 * ct-time.ts
 *
 * All CT (America/Chicago) time math lives here.
 * Zero calls to `new Date(\`${dayStr}T${time}\`)` — that pattern is local-TZ unsafe.
 *
 * Public API
 * ----------
 * toCTMinutes(d)                    UTC Date → minutes-since-midnight in CT
 * fromCTDayAndMinutes(dayStr, min)  CT day + CT minutes → UTC Date (DST-safe)
 * snapMinutes(min, step)            snap to nearest step boundary
 * fmtMinutes(min)                   510 → "8:30 AM"
 * fmtRange(startMin, endMin)        510, 570 → "8:30–9:30 AM"
 */

import { dayBoundsCT } from "@/lib/time";

const _ctFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour:     "2-digit",
  minute:   "2-digit",
  hour12:   false,
});

/** UTC Date → minutes since midnight in CT (0–1439). */
export function toCTMinutes(d: Date): number {
  const parts = _ctFmt.formatToParts(d);
  const h = parseInt(parts.find(p => p.type === "hour")?.value   ?? "0", 10);
  const m = parseInt(parts.find(p => p.type === "minute")?.value ?? "0", 10);
  return (h === 24 ? 0 : h) * 60 + m;
}

/**
 * CT date string + CT minutes since midnight → UTC Date.
 * dayBoundsCT handles DST, so this is always correct at transition boundaries.
 */
export function fromCTDayAndMinutes(dayStr: string, minutesCT: number): Date {
  const { start: midnight } = dayBoundsCT(dayStr);
  return new Date(midnight.getTime() + minutesCT * 60_000);
}

/** Snap to nearest `step`-minute boundary. */
export function snapMinutes(min: number, step = 30): number {
  return Math.round(min / step) * step;
}

/** Format CT minutes as "8:30 AM" / "12:00 PM". */
export function fmtMinutes(min: number): string {
  const h   = Math.floor(min / 60) % 24;
  const m   = min % 60;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Format a time range compactly.
 * Same AM/PM suffix only once if both times share the same half-day.
 *   510, 600 → "8:30–10:00 AM"
 *   690, 810 → "11:30 AM–1:30 PM"
 */
export function fmtRange(startMin: number, endMin: number): string {
  const fmtHM = (min: number) => {
    const h   = Math.floor(min / 60) % 24;
    const m   = min % 60;
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, "0")}`;
  };
  const startH = Math.floor(startMin / 60);
  const endH   = Math.floor(endMin   / 60);
  const startAmPm = startH < 12 ? "AM" : "PM";
  const endAmPm   = endH   < 12 ? "AM" : "PM";

  if (startAmPm === endAmPm) {
    return `${fmtHM(startMin)}–${fmtHM(endMin)} ${endAmPm}`;
  }
  return `${fmtHM(startMin)} ${startAmPm}–${fmtHM(endMin)} ${endAmPm}`;
}
