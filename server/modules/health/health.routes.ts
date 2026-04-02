import express from "express";
import { pool } from "../../db";
import { logger } from "../../core/utils/logger";

export const healthRouter = express.Router();

/**
 * GET /api/health
 * Liveness probe — always 200 while the process is running.
 */
healthRouter.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * GET /api/ready
 * Readiness probe — returns 200 when the DB is reachable, 503 when degraded.
 * Suitable for load-balancer and orchestration health checks.
 */
healthRouter.get("/api/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", checks: { db: "ok" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Readiness check failed", { source: "health", check: "db", message });
    res.status(503).json({ status: "degraded", checks: { db: "error" } });
  }
});
