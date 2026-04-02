/**
 * Request conversion lifecycle — single source of truth for which statuses
 * are eligible for conversion and which are terminal.
 *
 * Consumed by:
 *   - server/services/request-conversion.service.ts (guards inside transactions)
 *   - Any future tooling or documentation that needs to enumerate valid flows
 *
 * Nothing in this file touches the database.
 */

// ─── Status type ──────────────────────────────────────────────────────────────

/** All recognized request status values (matches the `status` column in `requests`). */
export const REQUEST_STATUSES = [
  "new",
  "triaged",
  "assessment_scheduled",
  "converted",
  "closed",
  "archived",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

// ─── Conversion eligibility ───────────────────────────────────────────────────

/**
 * Statuses from which a request may be converted to an estimate or job.
 * Requests outside this set are rejected at the start of any conversion attempt.
 */
export const CONVERTIBLE_STATUSES: ReadonlySet<RequestStatus> = new Set<RequestStatus>([
  "new",
  "triaged",
  "assessment_scheduled",
]);

/**
 * Statuses from which a request can no longer be modified or converted.
 * Attempts to convert from these states produce a clear rejection message.
 *
 * Note: `converted` is handled separately (409 Conflict) because it has already
 * produced a linked entity; `closed` and `archived` are 422 Unprocessable.
 */
export const TERMINAL_STATUSES: ReadonlySet<RequestStatus> = new Set<RequestStatus>([
  "converted",
  "closed",
  "archived",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if a request in this status may be converted to an estimate or job.
 */
export function isConvertible(status: RequestStatus): boolean {
  return CONVERTIBLE_STATUSES.has(status);
}

/**
 * Returns true if the status is terminal — no further conversions or modifications
 * are permitted without an explicit admin intervention.
 */
export function isTerminal(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Narrows an arbitrary string to `RequestStatus`.
 * Returns `undefined` if the value is not a recognized status.
 */
export function toRequestStatus(value: string): RequestStatus | undefined {
  return (REQUEST_STATUSES as ReadonlyArray<string>).includes(value)
    ? (value as RequestStatus)
    : undefined;
}
