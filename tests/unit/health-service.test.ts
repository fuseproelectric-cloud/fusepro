/**
 * Unit tests for health.service.ts
 *
 * DB pool and job queue are mocked so tests never touch real infrastructure.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (must be hoisted before any imports that pull the real modules) ────

const poolMock = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../../server/db", () => ({ pool: poolMock, db: {} }));

const jobQueueMock = vi.hoisted(() => ({ registeredHandlerCount: 2 }));

vi.mock("../../server/core/queue/job-queue", () => ({ jobQueue: jobQueueMock }));

// ─── Subject ──────────────────────────────────────────────────────────────────

import { healthService } from "../../server/core/health/health.service";

// ─── checkDb ─────────────────────────────────────────────────────────────────

describe("healthService.checkDb", () => {
  beforeEach(() => poolMock.query.mockReset());

  it("returns ok when SELECT 1 succeeds", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] });
    const result = await healthService.checkDb();

    expect(result.status).toBe("ok");
    expect(result.message).toBe("Database reachable");
    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(poolMock.query).toHaveBeenCalledWith("SELECT 1");
  });

  it("returns error when SELECT 1 throws", async () => {
    poolMock.query.mockRejectedValueOnce(new Error("connection refused"));
    const result = await healthService.checkDb();

    expect(result.status).toBe("error");
    expect(result.message).toBe("connection refused");
    expect(typeof result.latencyMs).toBe("number");
  });

  it("captures non-Error rejections as string", async () => {
    poolMock.query.mockRejectedValueOnce("socket hang up");
    const result = await healthService.checkDb();

    expect(result.status).toBe("error");
    expect(result.message).toBe("socket hang up");
  });
});

// ─── checkRedis ───────────────────────────────────────────────────────────────

describe("healthService.checkRedis", () => {
  it("reports not_configured — Redis is absent from this deployment", () => {
    const result = healthService.checkRedis();

    expect(result.status).toBe("not_configured");
    expect(result.message).toContain("Redis");
    expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("never returns ok, degraded, or error", () => {
    const result = healthService.checkRedis();
    expect(["ok", "degraded", "error"]).not.toContain(result.status);
  });
});

// ─── checkQueue ───────────────────────────────────────────────────────────────

describe("healthService.checkQueue", () => {
  it("returns ok when handlers are registered", () => {
    jobQueueMock.registeredHandlerCount = 2;
    const result = healthService.checkQueue();

    expect(result.status).toBe("ok");
    expect(result.message).toContain("2 handlers");
    expect(result.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns ok with singular 'handler' when count is 1", () => {
    jobQueueMock.registeredHandlerCount = 1;
    const result = healthService.checkQueue();

    expect(result.status).toBe("ok");
    expect(result.message).toContain("1 handler");
    expect(result.message).not.toContain("1 handlers");
  });

  it("returns degraded when no handlers are registered", () => {
    jobQueueMock.registeredHandlerCount = 0;
    const result = healthService.checkQueue();

    expect(result.status).toBe("degraded");
    expect(result.message).toContain("no registered handlers");
  });
});

// ─── checkAll ────────────────────────────────────────────────────────────────

describe("healthService.checkAll", () => {
  beforeEach(() => {
    poolMock.query.mockReset();
    jobQueueMock.registeredHandlerCount = 2;
  });

  it("returns ok overall when DB is healthy and queue has handlers", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] });
    const report = await healthService.checkAll();

    expect(report.status).toBe("ok");
    expect(report.checks.db.status).toBe("ok");
    expect(report.checks.redis.status).toBe("not_configured");
    expect(report.checks.queue.status).toBe("ok");
    expect(report.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns error overall when DB is unreachable", async () => {
    poolMock.query.mockRejectedValueOnce(new Error("DB down"));
    const report = await healthService.checkAll();

    expect(report.status).toBe("error");
    expect(report.checks.db.status).toBe("error");
  });

  it("returns degraded overall when only queue is degraded", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] });
    jobQueueMock.registeredHandlerCount = 0;
    const report = await healthService.checkAll();

    expect(report.status).toBe("degraded");
    expect(report.checks.db.status).toBe("ok");
    expect(report.checks.queue.status).toBe("degraded");
  });

  it("error takes precedence over degraded in overall status", async () => {
    poolMock.query.mockRejectedValueOnce(new Error("DB down"));
    jobQueueMock.registeredHandlerCount = 0;
    const report = await healthService.checkAll();

    expect(report.status).toBe("error");
  });

  it("not_configured redis does NOT influence overall status", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] });
    const report = await healthService.checkAll();

    // Redis is not_configured but overall should still be ok
    expect(report.checks.redis.status).toBe("not_configured");
    expect(report.status).toBe("ok");
  });

  it("includes all three dependency keys in checks", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] });
    const report = await healthService.checkAll();

    expect(Object.keys(report.checks).sort()).toEqual(["db", "queue", "redis"]);
  });
});
