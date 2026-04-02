/**
 * Background health monitor.
 *
 * Runs dependency health checks on a configurable interval and emits
 * structured log alerts when any dependency changes health state.
 *
 * ── Alert behaviour ───────────────────────────────────────────────────────────
 * Only state *transitions* are logged — no spam on steady healthy state:
 *   healthy  → unhealthy  logger.warn  "Dependency became unhealthy"
 *   unhealthy → healthy   logger.info  "Dependency recovered"
 *   first run (unhealthy) logger.warn  "Dependency unhealthy at startup"
 *   first run (healthy)   (silent — normal, no log noise)
 *
 * Alerting can be suppressed by setting ALERT_ON_HEALTH_TRANSITIONS=false.
 *
 * ── Env vars ─────────────────────────────────────────────────────────────────
 * HEALTHCHECK_INTERVAL_MS   interval in ms (default 60 000)
 * ALERT_ON_HEALTH_TRANSITIONS  "false" to disable transition logs (default on)
 */

import { healthService } from "./health.service";
import { logger } from "../utils/logger";
import type { HealthReport, HealthStatus } from "./health.types";

const DEFAULT_INTERVAL_MS = 60_000;

// ── Module-level state ────────────────────────────────────────────────────────

/** Status per dependency from the previous check cycle. */
const prevStatus = new Map<string, HealthStatus>();

/** Most recent full report — served by getLastReport(). */
let lastReport: HealthReport | null = null;

let monitorTimer: ReturnType<typeof setInterval> | null = null;

// ── Internal helpers ──────────────────────────────────────────────────────────

function alertingEnabled(): boolean {
  return process.env.ALERT_ON_HEALTH_TRANSITIONS !== "false";
}

function processReport(report: HealthReport, isFirstRun: boolean): void {
  lastReport = report;

  if (!alertingEnabled()) return;

  for (const [name, result] of Object.entries(report.checks)) {
    const curr = result.status;
    const prev = prevStatus.get(name);

    // Record current for next cycle before deciding whether to log.
    prevStatus.set(name, curr);

    // not_configured dependencies are intentionally absent — never alert.
    if (curr === "not_configured") continue;

    if (isFirstRun) {
      // Only alert on first run if something is already unhealthy.
      if (curr !== "ok") {
        logger.warn("Dependency unhealthy at startup", {
          source:     "health-monitor",
          dependency: name,
          status:     curr,
          message:    result.message,
        });
      }
      continue;
    }

    // Subsequent runs: log only on transitions.
    if (prev === curr) continue;

    if (curr === "ok") {
      logger.info("Dependency recovered", {
        source:         "health-monitor",
        dependency:     name,
        previousStatus: prev ?? "unknown",
        status:         curr,
        message:        result.message,
      });
    } else {
      logger.warn("Dependency health changed", {
        source:         "health-monitor",
        dependency:     name,
        previousStatus: prev ?? "unknown",
        status:         curr,
        message:        result.message,
      });
    }
  }
}

async function runCheck(isFirstRun: boolean): Promise<void> {
  const report = await healthService.checkAll();
  processReport(report, isFirstRun);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the background health monitor.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startHealthMonitor(): void {
  if (monitorTimer !== null) return;

  const intervalMs =
    parseInt(process.env.HEALTHCHECK_INTERVAL_MS ?? "", 10) || DEFAULT_INTERVAL_MS;

  logger.info("Health monitor started", {
    source:     "health-monitor",
    intervalMs,
    alerting:   alertingEnabled(),
  });

  // Run immediately to populate state and surface startup-time issues.
  runCheck(true).catch(err => {
    logger.error("Health monitor: initial check failed", {
      source:  "health-monitor",
      message: err instanceof Error ? err.message : String(err),
    });
  });

  monitorTimer = setInterval(() => {
    runCheck(false).catch(err => {
      logger.error("Health monitor: check failed", {
        source:  "health-monitor",
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }, intervalMs);

  // Do not keep the event loop alive just for the monitor.
  monitorTimer.unref();
}

/** Stop the monitor. Used in tests and graceful-shutdown scenarios. */
export function stopHealthMonitor(): void {
  if (monitorTimer !== null) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
  // Reset state so the next startHealthMonitor() call is treated as a first run.
  prevStatus.clear();
  lastReport = null;
}

/**
 * Return the most recent health report produced by the monitor.
 * Returns null if the monitor has not run its first check yet.
 */
export function getLastReport(): HealthReport | null {
  return lastReport;
}

/**
 * Expose processReport for unit testing without running the full check loop.
 * @internal
 */
export { processReport as _processReport };
