import express from "express";
import { healthService } from "../../core/health/health.service";

export const healthRouter = express.Router();

/**
 * GET /api/health
 * Liveness probe — always 200 while the process is running.
 * No dependency checks; used to confirm the process is alive.
 */
healthRouter.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * GET /api/ready
 * Readiness probe — runs all dependency checks and returns a structured report.
 *
 * 200 when overall status is "ok"
 * 503 when overall status is "degraded" or "error"
 *
 * Response shape:
 * {
 *   "status": "ok" | "degraded" | "error",
 *   "checks": {
 *     "db":    { "status": "ok", "message": "...", "latencyMs": 12, "checkedAt": "..." },
 *     "redis": { "status": "not_configured", "message": "...", "checkedAt": "..." },
 *     "queue": { "status": "ok", "message": "...", "checkedAt": "..." }
 *   },
 *   "checkedAt": "ISO timestamp"
 * }
 */
healthRouter.get("/api/ready", async (_req, res) => {
  const report = await healthService.checkAll();
  const httpStatus = report.status === "ok" ? 200 : 503;
  res.status(httpStatus).json(report);
});
