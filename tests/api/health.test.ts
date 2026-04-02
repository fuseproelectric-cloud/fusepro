/**
 * Tests for health and readiness endpoints.
 *
 * Health routes are tested in isolation (without the full session/route stack)
 * so the DB pool can be mocked cleanly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import supertest from "supertest";

// ─── Mock DB pool before importing health routes ──────────────────────────────

const poolMock = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("../../server/db", () => ({
  pool: poolMock,
  db:   {},
}));

// ─── Import health router after mock is in place ──────────────────────────────

import { healthRouter } from "../../server/modules/health/health.routes";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  return app;
}

// ─── GET /api/health ──────────────────────────────────────────────────────────

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
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
  beforeEach(() => poolMock.query.mockReset());

  it("returns 200 with ok checks when DB is reachable", async () => {
    poolMock.query.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const res = await supertest(buildApp()).get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: { db: "ok" } });
    expect(poolMock.query).toHaveBeenCalledWith("SELECT 1");
  });

  it("returns 503 with degraded status when DB is unreachable", async () => {
    poolMock.query.mockRejectedValueOnce(new Error("connection refused"));
    const res = await supertest(buildApp()).get("/api/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "degraded", checks: { db: "error" } });
  });

  it("never requires authentication", async () => {
    poolMock.query.mockResolvedValueOnce({});
    const res = await supertest(buildApp()).get("/api/ready");
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
