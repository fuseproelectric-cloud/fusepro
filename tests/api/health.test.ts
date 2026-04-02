/**
 * Integration tests for health and readiness endpoints.
 *
 * Health routes are tested in isolation (without the full session/route stack)
 * so DB pool and job queue can be mocked cleanly.
 *
 * Response shape as of the current implementation:
 *
 * GET /api/health  → 200  { status: "ok" }
 *
 * GET /api/ready   → 200 | 503
 *   {
 *     status: "ok" | "degraded" | "error",
 *     checks: {
 *       db:    { status, message, latencyMs, checkedAt },
 *       redis: { status: "not_configured", message, checkedAt },
 *       queue: { status, message, checkedAt }
 *     },
 *     checkedAt: "<ISO>"
 *   }
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import supertest from "supertest";

// ─── Mock DB pool ─────────────────────────────────────────────────────────────

const poolMock = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("../../server/db", () => ({ pool: poolMock, db: {} }));

// ─── Mock job queue ───────────────────────────────────────────────────────────

const jobQueueMock = vi.hoisted(() => ({ registeredHandlerCount: 2 }));

vi.mock("../../server/core/queue/job-queue", () => ({ jobQueue: jobQueueMock }));

// ─── Import router after mocks are in place ───────────────────────────────────

import { healthRouter } from "../../server/modules/health/health.routes";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  return app;
}

// ─── GET /api/health ──────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns 200 with { status: 'ok' }", async () => {
    const res = await supertest(buildApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("never requires authentication", async () => {
    const res = await supertest(buildApp()).get("/api/health");
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ─── GET /api/ready ───────────────────────────────────────────────────────────

describe("GET /api/ready", () => {
  beforeEach(() => {
    poolMock.query.mockReset();
    jobQueueMock.registeredHandlerCount = 2;
  });

  // ── Shape assertions (shared helper) ───────────────────────────────────────

  function assertReadyShape(body: Record<string, unknown>) {
    // Top-level fields
    expect(["ok", "degraded", "error"]).toContain(body.status);
    expect(typeof body.checkedAt).toBe("string");
    expect((body.checkedAt as string)).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Checks envelope
    const checks = body.checks as Record<string, unknown>;
    expect(checks).toBeDefined();
    expect(["db", "redis", "queue"].every(k => k in checks)).toBe(true);

    // Each check has required fields
    for (const key of ["db", "redis", "queue"]) {
      const c = checks[key] as Record<string, unknown>;
      expect(["ok", "degraded", "error", "not_configured"]).toContain(c.status);
      expect(typeof c.message).toBe("string");
      expect(typeof c.checkedAt).toBe("string");
    }
  }

  it("returns 200 and full structured report when all healthy", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] });
    const res = await supertest(buildApp()).get("/api/ready");

    expect(res.status).toBe(200);
    assertReadyShape(res.body);

    expect(res.body.status).toBe("ok");
    expect(res.body.checks.db.status).toBe("ok");
    expect(res.body.checks.db.message).toBe("Database reachable");
    expect(typeof res.body.checks.db.latencyMs).toBe("number");
    expect(res.body.checks.redis.status).toBe("not_configured");
    expect(res.body.checks.queue.status).toBe("ok");
  });

  it("returns 503 when DB is unreachable", async () => {
    poolMock.query.mockRejectedValueOnce(new Error("connection refused"));
    const res = await supertest(buildApp()).get("/api/ready");

    expect(res.status).toBe(503);
    assertReadyShape(res.body);
    expect(res.body.status).toBe("error");
    expect(res.body.checks.db.status).toBe("error");
    expect(res.body.checks.db.message).toBe("connection refused");
  });

  it("returns 503 when queue has no handlers", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] });
    jobQueueMock.registeredHandlerCount = 0;
    const res = await supertest(buildApp()).get("/api/ready");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.checks.queue.status).toBe("degraded");
    expect(res.body.checks.db.status).toBe("ok");
  });

  it("redis is always not_configured and does not affect HTTP status", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] });
    const res = await supertest(buildApp()).get("/api/ready");

    expect(res.status).toBe(200);
    expect(res.body.checks.redis.status).toBe("not_configured");
  });

  it("always returns all three check keys", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] });
    const res = await supertest(buildApp()).get("/api/ready");
    expect(Object.keys(res.body.checks).sort()).toEqual(["db", "queue", "redis"]);
  });

  it("never requires authentication", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] });
    const res = await supertest(buildApp()).get("/api/ready");
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("SELECT 1 is called exactly once per request", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [] });
    await supertest(buildApp()).get("/api/ready");
    expect(poolMock.query).toHaveBeenCalledTimes(1);
    expect(poolMock.query).toHaveBeenCalledWith("SELECT 1");
  });
});
