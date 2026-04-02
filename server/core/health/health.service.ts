/**
 * Health-check service.
 *
 * Provides individual checks for each infrastructure dependency and an
 * aggregated checkAll() used by both the readiness endpoint and the
 * health-monitor background loop.
 *
 * Stateless — every call runs fresh probes. The monitor layer owns
 * last-known state and transition detection.
 *
 * ── Dependency inventory ──────────────────────────────────────────────────────
 * DB    : PostgreSQL via pg pool — startup-critical, always checked
 * Redis : Not configured in this deployment; reported as not_configured
 * Queue : In-process only (setImmediate); health = handler registry populated
 */

import { pool } from "../../db";
import { jobQueue } from "../queue/job-queue";
import type { HealthCheckResult, HealthReport, HealthStatus } from "./health.types";

// ─── Individual checks ────────────────────────────────────────────────────────

async function checkDb(): Promise<HealthCheckResult> {
  const t0 = Date.now();
  try {
    await pool.query("SELECT 1");
    return {
      status:    "ok",
      message:   "Database reachable",
      latencyMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status:    "error",
      message:   err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - t0,
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Redis is not present in this deployment.
 * Sessions use PostgreSQL (connect-pg-simple).
 * The job queue is in-process and requires no Redis.
 *
 * If Redis is ever added, replace this with a real connection probe.
 */
function checkRedis(): HealthCheckResult {
  return {
    status:    "not_configured",
    message:   "Redis is not configured in this deployment",
    checkedAt: new Date().toISOString(),
  };
}

/**
 * For an in-process queue the proxy for "healthy" is whether handlers
 * are registered. An empty handler map means the init import chain
 * (server/core/queue/index.ts) never ran, which would be a boot error.
 */
function checkQueue(): HealthCheckResult {
  const count = jobQueue.registeredHandlerCount;
  if (count === 0) {
    return {
      status:    "degraded",
      message:   "In-process job queue has no registered handlers — initialization may have failed",
      checkedAt: new Date().toISOString(),
    };
  }
  return {
    status:    "ok",
    message:   `In-process job queue operational (${count} handler${count === 1 ? "" : "s"} registered)`,
    checkedAt: new Date().toISOString(),
  };
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Derive the overall status from individual check results.
 * Checks with status `not_configured` are excluded from the roll-up.
 */
function aggregate(results: HealthCheckResult[]): HealthStatus {
  const scorable = results.filter(r => r.status !== "not_configured");
  if (scorable.some(r => r.status === "error"))    return "error";
  if (scorable.some(r => r.status === "degraded")) return "degraded";
  return "ok";
}

// ─── Public service ───────────────────────────────────────────────────────────

export const healthService = {
  checkDb,
  checkRedis,
  checkQueue,

  /** Run all checks concurrently and return a unified report. */
  async checkAll(): Promise<HealthReport> {
    const checkedAt = new Date().toISOString();
    const [db, queue] = await Promise.all([checkDb(), Promise.resolve(checkQueue())]);
    const redis = checkRedis();

    const checks: Record<string, HealthCheckResult> = { db, redis, queue };
    return { status: aggregate([db, redis, queue]), checks, checkedAt };
  },
};
