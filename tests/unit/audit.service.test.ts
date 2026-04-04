/**
 * Unit tests for the audit log service.
 *
 * Covers:
 *   - record() never throws regardless of DB state
 *   - record() calls db.insert with the correct field mapping
 *   - Null defaults are applied for optional fields
 *   - Error during insert is caught and logged, not propagated
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mock variables ───────────────────────────────────────────────────
// Must use vi.hoisted() so these references are available when vi.mock factories
// are hoisted to the top of the module at compile time.

const { valuesMock, insertMock, loggerMock } = vi.hoisted(() => {
  const valuesMock = vi.fn().mockResolvedValue(undefined);
  const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
  const loggerMock = {
    debug: vi.fn(),
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
  };
  return { valuesMock, insertMock, loggerMock };
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../server/db", () => ({
  pool: { query: vi.fn(), end: vi.fn() },
  db:   { insert: insertMock },
}));

vi.mock("../../server/core/utils/logger", () => ({ logger: loggerMock }));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { auditLog } from "../../server/core/audit/audit.service";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("auditLog.record", () => {
  beforeEach(() => {
    insertMock.mockClear();
    valuesMock.mockClear();
    loggerMock.error.mockClear();
    insertMock.mockReturnValue({ values: valuesMock });
    valuesMock.mockResolvedValue(undefined);
  });

  it("does not throw for a fully specified entry", () => {
    expect(() => auditLog.record({
      requestId:          "req-123",
      performedByUserId:  5,
      action:             "job.created",
      entityType:         "job",
      entityId:           42,
      metadata:           { status: "pending" },
    })).not.toThrow();
  });

  it("does not throw when optional fields are omitted", () => {
    expect(() => auditLog.record({
      action:     "job.deleted",
      entityType: "job",
      entityId:   99,
    })).not.toThrow();
  });

  it("calls db.insert once", () => {
    auditLog.record({ action: "job.created", entityType: "job", entityId: 1 });
    expect(insertMock).toHaveBeenCalledOnce();
  });

  it("passes null for missing optional fields", () => {
    auditLog.record({ action: "job.deleted", entityType: "job" });
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId:          null,
        performedByUserId:  null,
        entityId:           null,
        metadata:           null,
      }),
    );
  });

  it("passes provided fields through correctly", () => {
    auditLog.record({
      requestId:          "abc",
      performedByUserId:  7,
      action:             "request.converted_to_job",
      entityType:         "request",
      entityId:           10,
      metadata:           { jobId: 20 },
    });
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId:          "abc",
        performedByUserId:  7,
        action:             "request.converted_to_job",
        entityType:         "request",
        entityId:           10,
        metadata:           { jobId: 20 },
      }),
    );
  });

  it("does not throw and logs error when db.insert rejects", async () => {
    const dbError = new Error("DB write failed");
    valuesMock.mockRejectedValueOnce(dbError);

    expect(() => auditLog.record({ action: "job.created", entityType: "job", entityId: 1 }))
      .not.toThrow();

    // Allow the rejected promise to settle
    await new Promise(resolve => setImmediate(resolve));

    expect(loggerMock.error).toHaveBeenCalledWith(
      "Audit log write failed",
      expect.objectContaining({ message: "DB write failed" }),
    );
  });

  it("does not throw and logs error when db.insert throws synchronously", () => {
    insertMock.mockImplementationOnce(() => { throw new Error("sync boom"); });

    expect(() => auditLog.record({ action: "job.created", entityType: "job", entityId: 1 }))
      .not.toThrow();

    expect(loggerMock.error).toHaveBeenCalledWith(
      "Audit log write failed (sync)",
      expect.objectContaining({ message: "sync boom" }),
    );
  });
});
