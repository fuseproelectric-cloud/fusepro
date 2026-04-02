/**
 * Estimate conversion lifecycle — single source of truth for which estimate
 * statuses are eligible for conversion to an invoice and which are terminal.
 *
 * Consumed by:
 *   - server/services/estimate-conversion.service.ts (guards inside transactions)
 *   - Any future tooling or documentation that needs to enumerate valid flows
 *
 * Nothing in this file touches the database.
 */

// ─── Status type ──────────────────────────────────────────────────────────────

/** All recognized estimate status values (matches the `status` column in `estimates`). */
export const ESTIMATE_STATUSES = [
  "draft",
  "awaiting_response",
  "changes_requested",
  "approved",
  "converted",
  "archived",
] as const;

export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

// ─── Invoice conversion eligibility ──────────────────────────────────────────

/**
 * Estimate statuses from which a conversion to invoice is permitted.
 *
 * `approved` — the standard path: estimate was approved by the customer.
 * `changes_requested` — also allowed so the "Convert to Invoice" button in the
 *   frontend works even when the customer requested changes but the dispatcher
 *   decides to proceed. This matches the PUT transition matrix in lifecycle.service.ts.
 */
export const CONVERTIBLE_TO_INVOICE_STATUSES: ReadonlySet<EstimateStatus> = new Set<EstimateStatus>([
  "approved",
  "changes_requested",
]);

/**
 * Estimate statuses that are terminal — no further conversion or modification
 * is permitted without an explicit admin intervention.
 *
 * Note: `converted` is handled separately (409 Conflict) because it has already
 * produced a linked invoice. `archived` is a 422 Unprocessable.
 */
export const TERMINAL_ESTIMATE_STATUSES: ReadonlySet<EstimateStatus> = new Set<EstimateStatus>([
  "converted",
  "archived",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if an estimate in this status may be converted to an invoice.
 */
export function isConvertibleToInvoice(status: EstimateStatus): boolean {
  return CONVERTIBLE_TO_INVOICE_STATUSES.has(status);
}

/**
 * Returns true if the estimate status is terminal — no further conversions or
 * modifications are permitted without an explicit admin action.
 */
export function isTerminalEstimateStatus(status: EstimateStatus): boolean {
  return TERMINAL_ESTIMATE_STATUSES.has(status);
}

/**
 * Narrows an arbitrary string to `EstimateStatus`.
 * Returns `undefined` if the value is not a recognized status.
 */
export function toEstimateStatus(value: string): EstimateStatus | undefined {
  return (ESTIMATE_STATUSES as ReadonlyArray<string>).includes(value)
    ? (value as EstimateStatus)
    : undefined;
}
