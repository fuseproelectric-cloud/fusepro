/**
 * Unit tests for numberingService.
 *
 * These tests verify that invoice and job number generation:
 *   - calls the correct PostgreSQL sequence via nextval()
 *   - formats the result with the expected prefix and zero-padding
 *   - returns a distinct value on every call (concurrency-safe by design)
 *
 * The pool is mocked so that pool.query() returns controlled sequence values.
 * In production, each nextval() call is atomic: two concurrent sessions always
 * receive different values regardless of transaction isolation level.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pool before importing the service so the module picks up the mock.
const poolMock = vi.hoisted(() => ({
  query: vi.fn(),
  end:   vi.fn(),
}));

vi.mock("../../server/db", () => ({ pool: poolMock, db: {} }));

import { numberingService } from "../../server/services/numbering.service";

describe("numberingService", () => {
  beforeEach(() => poolMock.query.mockReset());

  // ── nextInvoiceNumber ──────────────────────────────────────────────────────

  describe("nextInvoiceNumber()", () => {
    it("calls nextval('invoice_number_seq') on the pool", async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [{ val: "1" }] });
      await numberingService.nextInvoiceNumber();
      expect(poolMock.query).toHaveBeenCalledOnce();
      expect(poolMock.query).toHaveBeenCalledWith(
        expect.stringContaining("nextval('invoice_number_seq')"),
      );
    });

    it("formats single-digit values as INV-00001", async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [{ val: "1" }] });
      expect(await numberingService.nextInvoiceNumber()).toBe("INV-00001");
    });

    it("zero-pads to 5 digits (INV-00042 for sequence value 42)", async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [{ val: "42" }] });
      expect(await numberingService.nextInvoiceNumber()).toBe("INV-00042");
    });

    it("handles values exactly at the 5-digit boundary", async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [{ val: "99999" }] });
      expect(await numberingService.nextInvoiceNumber()).toBe("INV-99999");
    });

    it("handles values beyond 5 digits without truncation", async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [{ val: "100000" }] });
      expect(await numberingService.nextInvoiceNumber()).toBe("INV-100000");
    });

    it("returns a unique value on each call (concurrent-call simulation)", async () => {
      // Simulate two concurrent nextval() calls returning consecutive values —
      // the same guarantee PostgreSQL sequences provide in production.
      poolMock.query
        .mockResolvedValueOnce({ rows: [{ val: "10" }] })
        .mockResolvedValueOnce({ rows: [{ val: "11" }] });

      const [n1, n2] = await Promise.all([
        numberingService.nextInvoiceNumber(),
        numberingService.nextInvoiceNumber(),
      ]);

      expect(n1).toBe("INV-00010");
      expect(n2).toBe("INV-00011");
      expect(n1).not.toBe(n2);
    });

    it("does NOT call nextval('job_number_seq') for invoice numbers", async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [{ val: "5" }] });
      await numberingService.nextInvoiceNumber();
      const sql: string = poolMock.query.mock.calls[0][0];
      expect(sql).not.toContain("job_number_seq");
    });
  });

  // ── nextJobNumber ──────────────────────────────────────────────────────────

  describe("nextJobNumber()", () => {
    it("calls nextval('job_number_seq') on the pool", async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [{ val: "1" }] });
      await numberingService.nextJobNumber();
      expect(poolMock.query).toHaveBeenCalledWith(
        expect.stringContaining("nextval('job_number_seq')"),
      );
    });

    it("formats values as J-XXXX (4 digits, zero-padded)", async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [{ val: "7" }] });
      expect(await numberingService.nextJobNumber()).toBe("J-0007");
    });

    it("zero-pads to 4 digits (J-0042 for sequence value 42)", async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [{ val: "42" }] });
      expect(await numberingService.nextJobNumber()).toBe("J-0042");
    });

    it("returns unique values on concurrent calls", async () => {
      poolMock.query
        .mockResolvedValueOnce({ rows: [{ val: "100" }] })
        .mockResolvedValueOnce({ rows: [{ val: "101" }] });

      const [j1, j2] = await Promise.all([
        numberingService.nextJobNumber(),
        numberingService.nextJobNumber(),
      ]);

      expect(j1).not.toBe(j2);
    });

    it("does NOT call nextval('invoice_number_seq') for job numbers", async () => {
      poolMock.query.mockResolvedValueOnce({ rows: [{ val: "3" }] });
      await numberingService.nextJobNumber();
      const sql: string = poolMock.query.mock.calls[0][0];
      expect(sql).not.toContain("invoice_number_seq");
    });
  });

});
