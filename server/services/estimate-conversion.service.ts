/**
 * EstimateConversionService
 *
 * Owns the Estimate → Invoice conversion use case.
 *
 * Invariants enforced here (see also estimate-conversion.lifecycle.ts):
 *   - Only estimates in CONVERTIBLE_TO_INVOICE_STATUSES may be converted
 *     ('approved' or 'changes_requested').
 *   - An estimate may produce exactly one invoice.
 *   - The entire conversion (create invoice + update estimate status) is atomic.
 *   - The estimate row is locked with SELECT FOR UPDATE to prevent concurrent
 *     duplicate conversions of the same estimate.
 *
 * Idempotency is enforced by two guards (both inside the transaction):
 *   1. Status guard  — estimate.status === 'converted' → 409
 *   2. Data guard    — invoice row already exists with estimate_id → 409
 *   Both return the same HTTP message to the client. Server logs distinguish them.
 *
 * Invoice number note:
 *   The estimate row lock serializes conversions on a specific estimate.
 *   It does NOT prevent two different estimates being converted concurrently
 *   and colliding on invoice_number. UNIQUE(invoices_invoice_number_unique) is
 *   the active collision guard. A dedicated global numbering refactor is deferred.
 */

import { eq } from "drizzle-orm";
import type { Server as SocketServer } from "socket.io";
import { db } from "../db";
import { estimates, invoices } from "@shared/schema";
import type { Estimate, Invoice } from "@shared/schema";
import { AppError } from "../core/errors/app-error";
import { numberingService } from "./numbering.service";
import {
  type EstimateStatus,
  isConvertibleToInvoice,
} from "../modules/estimates/estimate-conversion.lifecycle";
import { auditLog } from "../core/audit/audit.service";

// ─── Error ────────────────────────────────────────────────────────────────────

/**
 * Thrown for all invalid estimate-to-invoice conversion attempts.
 * Extends AppError so it flows through the unified error middleware automatically,
 * producing the standard `{ error: { code, message } }` response shape.
 */
export class InvoiceConversionError extends AppError {
  constructor(
    message: string,
    statusCode: 404 | 409 | 422 | 500,
  ) {
    super(message, statusCode, "CONVERSION_ERROR");
    this.name = "InvoiceConversionError";
  }
}

// ─── Postgres error codes ─────────────────────────────────────────────────────

const PG_UNIQUE_VIOLATION = "23505";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EstimateConversionParams {
  estimateId: number;
  /** ID of the dispatcher initiating the conversion — used for post-commit events. */
  performedBy: number;
  /** Defaults to "due_on_receipt" if omitted. */
  paymentTerms?: string;
  io?: SocketServer;
  /** HTTP request correlation ID for audit log. */
  traceId?: string;
}

/**
 * Internal result type. Route handlers expose only `invoice` to the client.
 * The full shape is retained for future admin flows or richer endpoints.
 */
export interface EstimateConversionResult {
  estimate: Estimate;
  invoice: Invoice;
}

// ─── Conversion guard ─────────────────────────────────────────────────────────

/**
 * Validates that `est` is eligible for conversion to an invoice.
 * Must be called inside the SELECT FOR UPDATE transaction so that the status
 * read is consistent with the subsequent INSERT + UPDATE writes.
 *
 * Eligibility rules (defined in estimate-conversion.lifecycle.ts):
 *   - CONVERTIBLE_TO_INVOICE_STATUSES: approved, changes_requested
 *   - "converted" → 409 Conflict (already produced a linked invoice)
 *   - "archived"  → 422 with tailored message
 *   - any other non-convertible status → 422
 */
function assertConvertibleToInvoice(est: Estimate | undefined): void {
  if (!est) {
    throw new InvoiceConversionError("Estimate not found.", 404);
  }

  const status = est.status as EstimateStatus;

  if (status === "converted") {
    throw new InvoiceConversionError("Estimate is already converted.", 409);
  }

  if (!isConvertibleToInvoice(status)) {
    const msg = status === "archived"
      ? "Cannot convert an archived estimate."
      : `Only approved estimates can be converted to invoices. Current status: ${status}.`;
    throw new InvoiceConversionError(msg, 422);
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const estimateConversionService = {

  /**
   * Converts an approved (or changes_requested) estimate to a draft invoice.
   *
   * Transaction steps:
   *   1. Lock estimate row FOR UPDATE
   *   2. Assert eligibility (assertConvertibleToInvoice)
   *   3. Data guard: reject if invoice already exists for this estimate (409)
   *   4. Generate invoice number inside the transaction
   *   5. INSERT invoice with all financial fields copied from estimate
   *   6. UPDATE estimate.status → 'converted'
   *   7. Commit
   *   8. Emit estimate:converted to staff:notifications (post-commit)
   */
  async toInvoice(params: EstimateConversionParams): Promise<EstimateConversionResult> {
    const { estimateId, performedBy, paymentTerms = "due_on_receipt", io, traceId } = params;

    let committedEstimate!: Estimate;
    let committedInvoice!: Invoice;

    try {
      await db.transaction(async (tx) => {
        const txDb = tx as unknown as typeof db;

        // 1. Lock estimate row — serializes concurrent conversions of THIS estimate.
        //    The lock does not affect conversions of other estimates running in parallel.
        const lockedRows = await txDb
          .select()
          .from(estimates)
          .where(eq(estimates.id, estimateId))
          .for("update");
        const est = lockedRows[0] as Estimate | undefined;

        // 2. Assert eligibility inside the lock (checks status, not-found, archived)
        assertConvertibleToInvoice(est);

        // 3. Data guard — catches inconsistent state where an invoice was created
        //    without updating estimate.status to 'converted' (e.g. migration remnants).
        const existingInvoiceRows = await txDb
          .select({ id: invoices.id })
          .from(invoices)
          .where(eq(invoices.estimateId, estimateId))
          .limit(1);
        if (existingInvoiceRows.length > 0) {
          console.info(`[estimate-conversion] blocked: invoice ${existingInvoiceRows[0].id} already exists for estimate ${estimateId}`);
          throw new InvoiceConversionError("Estimate is already converted.", 409);
        }

        // 4. Generate invoice number via sequence — atomic and concurrency-safe.
        //    UNIQUE(invoices_invoice_number_unique) remains as a last-resort safety net.
        const invoiceNumber = await numberingService.nextInvoiceNumber();

        // 5. Insert invoice — copy all approved financial fields from the estimate exactly.
        //
        //    Intentionally excluded fields:
        //    • deposit / depositPaid — estimate-stage commercial fields only; there is no
        //      deposit-credit model on invoices. Do not propagate.
        //    • allowPartialPayment — hardcoded false; dispatcher controls this post-creation
        //      via PUT /api/invoices/:id. There is no partial-payment ledger to enforce it.
        //
        //    dueDate: auto-derived from paymentTerms at conversion time (net_N → today + N days).
        //    For due_on_receipt the dueDate remains null. Dispatcher may override via edit.
        //    dueDate is NOT recomputed on subsequent updates; 'overdue' is a manual status.
        const NET_DAYS: Record<string, number> = { net_15: 15, net_30: 30, net_60: 60 };
        const netDays = NET_DAYS[paymentTerms];
        let derivedDueDate: Date | null = null;
        if (netDays !== undefined) {
          derivedDueDate = new Date();
          derivedDueDate.setDate(derivedDueDate.getDate() + netDays);
        }

        const [newInvoice] = await txDb
          .insert(invoices)
          .values({
            estimateId:          est!.id,
            customerId:          est!.customerId,
            jobId:               est!.jobId ?? null,
            invoiceNumber,
            subject:             est!.title,
            status:              "draft",
            paymentTerms,
            allowPartialPayment: false,
            lineItems:           (est!.lineItems ?? []) as any,
            subtotal:            est!.subtotal ?? "0",
            tax:                 est!.tax ?? "0",
            total:               est!.total ?? "0",
            notes:               est!.notes ?? null,
            clientMessage:       est!.clientMessage ?? null,
            dueDate:             derivedDueDate,
          })
          .returning();
        committedInvoice = newInvoice;

        // 6. Mark estimate as converted
        const [updatedEst] = await txDb
          .update(estimates)
          .set({ status: "converted" })
          .where(eq(estimates.id, estimateId))
          .returning();
        committedEstimate = updatedEst as Estimate;
      });
    } catch (err: any) {
      // UNIQUE(invoices_invoice_number_unique) fired — concurrent numbering collision.
      // Rare and retryable; surfaces a clear message rather than a generic server error.
      if (err?.code === PG_UNIQUE_VIOLATION && err?.constraint === "invoices_invoice_number_unique") {
        throw new InvoiceConversionError("Invoice number conflict — please retry.", 500);
      }
      // UNIQUE(invoices_estimate_id_unique) fired — parallel conversion of the same
      // estimate committed first. Treat as already-converted.
      if (err?.code === PG_UNIQUE_VIOLATION && err?.constraint === "invoices_estimate_id_unique") {
        throw new InvoiceConversionError("Estimate is already converted.", 409);
      }
      // InvoiceConversionError instances (from assertConvertibleToInvoice) propagate unchanged
      throw err;
    }

    // 7. Post-commit: notify staff — only after successful commit
    if (io) {
      io.to("staff:notifications").emit("estimate:converted", {
        estimateId,
        invoiceId:   committedInvoice.id,
        performedBy,
      });
    }

    auditLog.record({
      requestId:          traceId,
      performedByUserId:  performedBy,
      action:             "estimate.converted_to_invoice",
      entityType:         "estimate",
      entityId:           estimateId,
      metadata:           { invoiceId: committedInvoice.id, invoiceNumber: committedInvoice.invoiceNumber, paymentTerms },
    });

    return { estimate: committedEstimate, invoice: committedInvoice };
  },
};
