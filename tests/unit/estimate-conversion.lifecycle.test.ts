import { describe, it, expect } from "vitest";
import {
  ESTIMATE_STATUSES,
  CONVERTIBLE_TO_INVOICE_STATUSES,
  TERMINAL_ESTIMATE_STATUSES,
  isConvertibleToInvoice,
  isTerminalEstimateStatus,
  toEstimateStatus,
} from "../../server/modules/estimates/estimate-conversion.lifecycle";

describe("estimate-conversion.lifecycle", () => {

  describe("ESTIMATE_STATUSES", () => {
    it("contains all expected status values", () => {
      expect(ESTIMATE_STATUSES).toContain("draft");
      expect(ESTIMATE_STATUSES).toContain("awaiting_response");
      expect(ESTIMATE_STATUSES).toContain("changes_requested");
      expect(ESTIMATE_STATUSES).toContain("approved");
      expect(ESTIMATE_STATUSES).toContain("converted");
      expect(ESTIMATE_STATUSES).toContain("archived");
    });
  });

  describe("isConvertibleToInvoice", () => {
    it("allows approved estimates", () => {
      expect(isConvertibleToInvoice("approved")).toBe(true);
    });

    it("allows changes_requested estimates (frontend Convert button supports this state)", () => {
      expect(isConvertibleToInvoice("changes_requested")).toBe(true);
    });

    it("rejects converted (already produced an invoice)", () => {
      expect(isConvertibleToInvoice("converted")).toBe(false);
    });

    it("rejects draft estimates", () => {
      expect(isConvertibleToInvoice("draft")).toBe(false);
    });

    it("rejects awaiting_response estimates", () => {
      expect(isConvertibleToInvoice("awaiting_response")).toBe(false);
    });

    it("rejects archived estimates", () => {
      expect(isConvertibleToInvoice("archived")).toBe(false);
    });
  });

  describe("isTerminalEstimateStatus", () => {
    it("marks converted and archived as terminal", () => {
      expect(isTerminalEstimateStatus("converted")).toBe(true);
      expect(isTerminalEstimateStatus("archived")).toBe(true);
    });

    it("does not mark active statuses as terminal", () => {
      expect(isTerminalEstimateStatus("draft")).toBe(false);
      expect(isTerminalEstimateStatus("awaiting_response")).toBe(false);
      expect(isTerminalEstimateStatus("changes_requested")).toBe(false);
      expect(isTerminalEstimateStatus("approved")).toBe(false);
    });

    it("CONVERTIBLE and TERMINAL sets are disjoint", () => {
      for (const s of CONVERTIBLE_TO_INVOICE_STATUSES) {
        expect(TERMINAL_ESTIMATE_STATUSES.has(s)).toBe(false);
      }
    });
  });

  describe("toEstimateStatus", () => {
    it("returns the status for valid values", () => {
      expect(toEstimateStatus("draft")).toBe("draft");
      expect(toEstimateStatus("approved")).toBe("approved");
      expect(toEstimateStatus("converted")).toBe("converted");
    });

    it("returns undefined for unknown values", () => {
      expect(toEstimateStatus("unknown")).toBeUndefined();
      expect(toEstimateStatus("")).toBeUndefined();
      expect(toEstimateStatus("APPROVED")).toBeUndefined();
    });
  });

});
