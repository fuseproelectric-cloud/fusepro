/**
 * EstimateConversionService
 *
 * Owns the Estimate → Invoice conversion use case.
 *
 * Invariants enforced here:
 *   - Only estimates in status 'approved' may be converted.
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
import { ConversionError } from "./request-conversion.service";
import { numberingService } from "./numbering.service";

// Re-export so route handlers can import ConversionError from either service file.
export { ConversionError };

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
}

/**
 * Internal result type. Route handlers expose only `invoice` to the client.
 * The full shape is retained for future admin flows or richer endpoints.
 */
export interface EstimateConversionResult {
  estimate: Estimate;
  invoice: Invoice;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const estimateConversionService = {

  /**
   * Converts an approved estimate to a draft invoice.
   *
   * Transaction steps:
   *   1. Lock estimate row FOR UPDATE
   *   2. Status guard: reject if already converted (409)
   *   3. Data guard: reject if invoice already exists for this estimate (409)
   *   4. State guard: reject if not in 'approved' state (422)
   *   5. Generate invoice number inside the transaction
   *   6. INSERT invoice with all financial fields copied from estimate
   *   7. UPDATE estimate.status → 'converted'
   *   8. Commit
   *   9. Emit estimate:converted to staff:notifications (post-commit)
   */
  async toInvoice(params: EstimateConversionParams): Promise<EstimateConversionResult> {
    const { estimateId, performedBy, paymentTerms = "due_on_receipt", io } = params;

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

        if (!est) {
          throw new ConversionError("Estimate not found.", 404);
        }

        // 2. Status guard (fast path — most common idempotency case)
        if (est.status === "converted") {
          // Log cause for debugging; HTTP message is unified with data guard below
          console.info(`[estimate-conversion] blocked: estimate ${estimateId} status=converted`);
          throw new ConversionError("Estimate is already converted.", 409);
        }

        // 3. Data guard — catches inconsistent state where an invoice was created
        //    via the old UI-driven flow without updating estimate.status to 'converted'
        const existingInvoiceRows = await txDb
          .select({ id: invoices.id })
          .from(invoices)
          .where(eq(invoices.estimateId, estimateId))
          .limit(1);
        if (existingInvoiceRows.length > 0) {
          console.info(`[estimate-conversion] blocked: invoice ${existingInvoiceRows[0].id} already exists for estimate ${estimateId}`);
          throw new ConversionError("Estimate is already converted.", 409);
        }

        // 4. State guard — only approved estimates may be converted
        if (est.status !== "approved") {
          throw new ConversionError(
            "Only approved estimates can be converted to invoices.",
            422,
          );
        }

        // 5. Generate invoice number via sequence — atomic and concurrency-safe.
        //    UNIQUE(invoices_invoice_number_unique) remains as a last-resort safety net.
        const invoiceNumber = await numberingService.nextInvoiceNumber();

        // 6. Insert invoice — copy all approved financial fields from the estimate exactly.
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
            estimateId:          est.id,
            customerId:          est.customerId,
            jobId:               est.jobId ?? null,
            invoiceNumber,
            subject:             est.title,
            status:              "draft",
            paymentTerms,
            allowPartialPayment: false,
            lineItems:           (est.lineItems ?? []) as any,
            subtotal:            est.subtotal ?? "0",
            tax:                 est.tax ?? "0",
            total:               est.total ?? "0",
            notes:               est.notes ?? null,
            clientMessage:       est.clientMessage ?? null,
            dueDate:             derivedDueDate,
          })
          .returning();
        committedInvoice = newInvoice;

        // 7. Mark estimate as converted
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
        throw new ConversionError("Invoice number conflict — please retry.", 500);
      }
      // UNIQUE(invoices_estimate_id_unique) fired — parallel conversion of the same
      // estimate committed first. Treat as already-converted.
      if (err?.code === PG_UNIQUE_VIOLATION && err?.constraint === "invoices_estimate_id_unique") {
        throw new ConversionError("Estimate is already converted.", 409);
      }
      // ConversionError instances (from guards above) and unexpected errors propagate unchanged
      throw err;
    }

    // 8. Post-commit: notify staff — only after successful commit
    if (io) {
      io.to("staff:notifications").emit("estimate:converted", {
        estimateId,
        invoiceId:   committedInvoice.id,
        performedBy,
      });
    }

    return { estimate: committedEstimate, invoice: committedInvoice };
  },
};
