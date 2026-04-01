/**
 * LifecycleService
 *
 * Enforces status transition rules for Requests, Estimates, and Invoices.
 * All three entities have terminal states that must not be overwritten via
 * generic PUT handlers.
 *
 * Transition matrices:
 *
 *   Request:  new → triaged | assessment_scheduled | closed | archived
 *             triaged → assessment_scheduled | closed | archived
 *             assessment_scheduled → triaged | closed | archived
 *             any → converted (only via /convert-* endpoints, not PUT)
 *             Terminal: converted, closed, archived (no restore via PUT)
 *
 *   Estimate: draft → awaiting_response → approved → converted
 *             awaiting_response ↔ changes_requested → draft
 *             approved | changes_requested → converted (direct PUT)
 *             any non-terminal → archived (one-way, no restore via PUT)
 *             converted is TERMINAL; archived is one-way
 *
 *   Invoice:  draft → sent → paid
 *             sent → overdue → paid
 *             paid is TERMINAL (no "archived" — not a valid invoice status)
 */

import { db } from "../db";
import { requests, estimates, invoices } from "@shared/schema";
import type { Request as ServiceRequest, Estimate, Invoice } from "@shared/schema";
import { eq } from "drizzle-orm";

// ─── Error ────────────────────────────────────────────────────────────────────

export class LifecycleError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 409 | 422,
  ) {
    super(message);
    this.name = "LifecycleError";
  }
}

// ─── Transition matrices ──────────────────────────────────────────────────────

/**
 * Valid Request status transitions via PUT /api/requests/:id.
 * "converted" is excluded: it may only be set by the /convert-* endpoints.
 * Terminal states (converted, closed, archived) may not be the source of any transition.
 */
const REQUEST_ALLOWED: ReadonlySet<string> = new Set([
  "new→triaged",
  "new→assessment_scheduled",
  "new→closed",
  "new→archived",
  "triaged→assessment_scheduled",
  "triaged→closed",
  "triaged→archived",
  "assessment_scheduled→triaged",
  "assessment_scheduled→closed",
  "assessment_scheduled→archived",
]);

/**
 * Valid Estimate status transitions via PUT /api/estimates/:id.
 * "converted" is reachable from "approved" or "changes_requested" —
 *   the frontend Convert-to-Invoice button works from both states;
 *   an admin can mark the estimate converted after creating the invoice.
 * "archived" is one-way — no restore via normal PUT.
 */
const ESTIMATE_ALLOWED: ReadonlySet<string> = new Set([
  "draft→awaiting_response",
  "awaiting_response→approved",
  "awaiting_response→changes_requested",
  "changes_requested→draft",
  "approved→changes_requested",
  "approved→converted",
  "changes_requested→converted",
  "draft→archived",
  "awaiting_response→archived",
  "changes_requested→archived",
  "approved→archived",
]);

/**
 * Valid Invoice status transitions via PUT /api/invoices/:id.
 * Valid statuses: draft | sent | paid | overdue  (no "archived" — not in DB schema).
 * "overdue" may be set by admin/dispatcher or a future scheduler.
 * "paid" is terminal — no reversal.
 */
const INVOICE_ALLOWED: ReadonlySet<string> = new Set([
  "draft→sent",
  "sent→paid",
  "sent→overdue",
  "overdue→paid",
]);

// ─── Service ──────────────────────────────────────────────────────────────────

export const lifecycleService = {

  /**
   * Validates a Request status transition issued via PUT /api/requests/:id.
   * Throws if the current state is terminal or the transition is not in the matrix.
   */
  validateRequestTransition(currentStatus: string, newStatus: string): void {
    if (currentStatus === newStatus) return; // idempotent no-op

    // Terminal states — no further transitions allowed via PUT
    if (currentStatus === "converted") {
      throw new LifecycleError("Request is already converted and cannot be changed.", 422);
    }
    if (currentStatus === "closed") {
      throw new LifecycleError("Request is closed and cannot be changed.", 422);
    }
    if (currentStatus === "archived") {
      throw new LifecycleError("Request is archived and cannot be changed.", 422);
    }

    // "converted" is write-protected — must go through /convert-* endpoints
    if (newStatus === "converted") {
      throw new LifecycleError(
        "Status 'converted' can only be set via the convert-estimate or convert-job actions.",
        422,
      );
    }

    const key = `${currentStatus}→${newStatus}`;
    if (!REQUEST_ALLOWED.has(key)) {
      throw new LifecycleError(
        `Transition '${currentStatus}' → '${newStatus}' is not allowed for requests.`,
        422,
      );
    }
  },

  /**
   * Validates an Estimate status transition issued via PUT /api/estimates/:id.
   */
  validateEstimateTransition(currentStatus: string, newStatus: string): void {
    if (currentStatus === newStatus) return;

    if (currentStatus === "converted") {
      throw new LifecycleError(
        "Estimate is already converted and cannot be changed.",
        422,
      );
    }

    const key = `${currentStatus}→${newStatus}`;
    if (!ESTIMATE_ALLOWED.has(key)) {
      throw new LifecycleError(
        `Transition '${currentStatus}' → '${newStatus}' is not allowed for estimates.`,
        422,
      );
    }
  },

  /**
   * Validates an Invoice status transition issued via PUT /api/invoices/:id.
   */
  validateInvoiceTransition(currentStatus: string, newStatus: string): void {
    if (currentStatus === newStatus) return;

    if (currentStatus === "paid") {
      throw new LifecycleError(
        "Invoice is paid and cannot be changed.",
        422,
      );
    }

    const key = `${currentStatus}→${newStatus}`;
    if (!INVOICE_ALLOWED.has(key)) {
      throw new LifecycleError(
        `Transition '${currentStatus}' → '${newStatus}' is not allowed for invoices.`,
        422,
      );
    }
  },

  /**
   * Pre-flight for POST /api/requests/:id/convert-estimate|convert-job.
   * Ensures the request is in a convertible state before creating the downstream entity.
   */
  validateRequestConvertible(currentStatus: string): void {
    if (currentStatus === "converted") {
      throw new LifecycleError("Request is already converted.", 409);
    }
    if (currentStatus === "archived") {
      throw new LifecycleError("Cannot convert an archived request.", 422);
    }
  },
};
