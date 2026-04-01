import { describe, it, expect } from "vitest";
import { todayStrCT, dayBoundsCT, weekBoundsCT, monthStartCT } from "../../server/lib/time";

describe("Time utilities (America/Chicago)", () => {
  describe("todayStrCT", () => {
    it("returns a string in YYYY-MM-DD format", () => {
      const result = todayStrCT();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("dayBoundsCT", () => {
    it("returns start and end as Date objects", () => {
      const { start, end } = dayBoundsCT("2026-03-28");
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
    });

    it("end is exactly 24 hours after start", () => {
      const { start, end } = dayBoundsCT("2026-03-28");
      const diff = end.getTime() - start.getTime();
      expect(diff).toBe(24 * 60 * 60 * 1000);
    });

    it("start is midnight CT (CST: UTC-6)", () => {
      // 2026-01-15 is in CST (UTC-6), so midnight CT = 06:00 UTC
      const { start } = dayBoundsCT("2026-01-15");
      expect(start.getUTCHours()).toBe(6);
    });

    it("start is midnight CT (CDT: UTC-5)", () => {
      // 2026-07-15 is in CDT (UTC-5), so midnight CT = 05:00 UTC
      const { start } = dayBoundsCT("2026-07-15");
      expect(start.getUTCHours()).toBe(5);
    });

    it("uses today when no date string provided", () => {
      const { start, end } = dayBoundsCT();
      expect(start).toBeInstanceOf(Date);
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it("start and end span the correct CT date", () => {
      const { start, end } = dayBoundsCT("2026-06-01");
      // Any timestamp in this range should format to "2026-06-01" in CT
      const midday = new Date(start.getTime() + 12 * 60 * 60 * 1000);
      const ctStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(midday);
      expect(ctStr).toBe("2026-06-01");
    });
  });

  describe("weekBoundsCT", () => {
    it("returns start, end, and 7 dayStrings", () => {
      const { start, end, dayStrings } = weekBoundsCT("2026-03-28");
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect(dayStrings).toHaveLength(7);
    });

    it("week starts on Monday", () => {
      // 2026-03-28 is a Saturday, so Monday of that week is 2026-03-23
      const { dayStrings } = weekBoundsCT("2026-03-28");
      expect(dayStrings[0]).toBe("2026-03-23");
    });

    it("week ends on Sunday", () => {
      const { dayStrings } = weekBoundsCT("2026-03-28");
      expect(dayStrings[6]).toBe("2026-03-29");
    });

    it("end is after start", () => {
      const { start, end } = weekBoundsCT("2026-03-28");
      expect(end.getTime()).toBeGreaterThan(start.getTime());
    });

    it("span is exactly 7 days", () => {
      const { start, end } = weekBoundsCT("2026-03-28");
      const diff = end.getTime() - start.getTime();
      expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe("monthStartCT", () => {
    it("returns a Date object", () => {
      const result = monthStartCT();
      expect(result).toBeInstanceOf(Date);
    });

    it("returned date is the first day of the current CT month", () => {
      const result = monthStartCT();
      const ctStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(result);
      const [_y, _m, d] = ctStr.split("-");
      expect(d).toBe("01");
    });

    it("is a midnight CT boundary", () => {
      // The start of the month should be midnight CT
      const result = monthStartCT();
      // Verify it's at midnight CT by checking dayBounds of the first day
      const today = todayStrCT();
      const [y, m] = today.split("-");
      const firstDay = `${y}-${m}-01`;
      const { start } = dayBoundsCT(firstDay);
      expect(result.getTime()).toBe(start.getTime());
    });
  });
});
