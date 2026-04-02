/**
 * Shared types for the health-check and monitoring subsystem.
 */

/**
 * Per-dependency health status.
 *
 * - ok            → dependency is reachable and functioning normally
 * - degraded      → dependency is reachable but slow or partially impaired
 * - error         → dependency is unreachable or has thrown
 * - not_configured → dependency is intentionally absent in this deployment
 *                    (e.g. Redis); never treated as a failure
 */
export type HealthStatus = "ok" | "degraded" | "error" | "not_configured";

/** Result of a single dependency health check. */
export interface HealthCheckResult {
  status:    HealthStatus;
  message:   string;
  latencyMs?: number;
  checkedAt: string; // ISO 8601
}

/**
 * Aggregated snapshot returned by /api/ready and the health monitor.
 *
 * Overall status is the worst of all checks that are not `not_configured`.
 * A deployment where every active dependency is healthy reports "ok" even
 * when optional dependencies (redis) are not_configured.
 */
export interface HealthReport {
  status:   HealthStatus;
  checks:   Record<string, HealthCheckResult>;
  checkedAt: string; // ISO 8601
}
