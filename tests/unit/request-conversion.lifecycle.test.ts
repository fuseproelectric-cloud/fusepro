import { describe, it, expect } from "vitest";
import {
  REQUEST_STATUSES,
  CONVERTIBLE_STATUSES,
  TERMINAL_STATUSES,
  isConvertible,
  isTerminal,
  toRequestStatus,
} from "../../server/modules/requests/request-conversion.lifecycle";

describe("request-conversion.lifecycle", () => {

  describe("REQUEST_STATUSES", () => {
    it("contains all expected status values", () => {
      expect(REQUEST_STATUSES).toContain("new");
      expect(REQUEST_STATUSES).toContain("triaged");
      expect(REQUEST_STATUSES).toContain("assessment_scheduled");
      expect(REQUEST_STATUSES).toContain("converted");
      expect(REQUEST_STATUSES).toContain("closed");
      expect(REQUEST_STATUSES).toContain("archived");
    });
  });

  describe("isConvertible", () => {
    it("allows new, triaged, assessment_scheduled", () => {
      expect(isConvertible("new")).toBe(true);
      expect(isConvertible("triaged")).toBe(true);
      expect(isConvertible("assessment_scheduled")).toBe(true);
    });

    it("rejects converted (already done)", () => {
      expect(isConvertible("converted")).toBe(false);
    });

    it("rejects terminal statuses closed and archived", () => {
      expect(isConvertible("closed")).toBe(false);
      expect(isConvertible("archived")).toBe(false);
    });
  });

  describe("isTerminal", () => {
    it("marks converted, closed, archived as terminal", () => {
      expect(isTerminal("converted")).toBe(true);
      expect(isTerminal("closed")).toBe(true);
      expect(isTerminal("archived")).toBe(true);
    });

    it("does not mark active statuses as terminal", () => {
      expect(isTerminal("new")).toBe(false);
      expect(isTerminal("triaged")).toBe(false);
      expect(isTerminal("assessment_scheduled")).toBe(false);
    });

    it("CONVERTIBLE_STATUSES and TERMINAL_STATUSES are disjoint", () => {
      for (const s of CONVERTIBLE_STATUSES) {
        expect(TERMINAL_STATUSES.has(s)).toBe(false);
      }
    });
  });

  describe("toRequestStatus", () => {
    it("returns the status for valid values", () => {
      expect(toRequestStatus("new")).toBe("new");
      expect(toRequestStatus("converted")).toBe("converted");
      expect(toRequestStatus("archived")).toBe("archived");
    });

    it("returns undefined for unknown values", () => {
      expect(toRequestStatus("unknown")).toBeUndefined();
      expect(toRequestStatus("")).toBeUndefined();
      expect(toRequestStatus("NEW")).toBeUndefined();
    });
  });

});
