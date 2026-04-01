import { addDays, startOfWeek } from "date-fns";
import { dateStrCT, fmtTime } from "@/lib/time";

/** Mon–Sun array of Date objects for the week containing `date` */
export function getDaysOfWeek(date: Date): Date[] {
  const mon = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

/** Monday and Sunday of the week containing `date` */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const days = getDaysOfWeek(date);
  return { start: days[0], end: days[6] };
}

/** Compare two dates by CT date string — DST-safe, ignores time */
export function isSameDay(a: Date, b: Date): boolean {
  return dateStrCT(a) === dateStrCT(b);
}

/** "9:30 AM" or "9:30 AM – 10:30 AM" when end is provided */
export function formatTimeRange(start: Date | string, end?: Date | string): string {
  return end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start);
}

/** Move `date` by `weeks` weeks (positive = forward, negative = backward) */
export function shiftWeek(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export { dateStrCT };
