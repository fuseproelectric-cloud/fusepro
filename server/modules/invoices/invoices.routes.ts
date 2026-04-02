import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { insertInvoiceSchema } from "@shared/schema";
import { requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { invoicesRepository } from "./invoices.repository";
import { lifecycleService, LifecycleError } from "../../services/lifecycle.service";
import { ValidationError, NotFoundError, ConflictError } from "../../core/errors/app-error";

// PostgreSQL unique violation error code
const PG_UNIQUE_VIOLATION = "23505";

export const invoicesRouter = Router();

// ─── Invoices ─────────────────────────────────────────────────────────────────

invoicesRouter.get("/api/invoices", requireRole("admin", "dispatcher"), async (_req, res) => {
  try {
    const data = await invoicesRepository.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to load invoices" });
  }
});

invoicesRouter.get("/api/invoices/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid invoice id" });
    const inv = await invoicesRepository.getById(id);
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    res.json(inv);
  } catch (err) {
    res.status(500).json({ message: "Failed to load invoice" });
  }
});

invoicesRouter.post("/api/invoices", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoiceNumber = await invoicesRepository.getNextInvoiceNumber();
    const body = { ...req.body, invoiceNumber };

    // Auto-derive dueDate from paymentTerms when the caller does not supply one.
    // This is the only place dueDate is computed automatically — it is NOT re-derived
    // on subsequent updates, and 'overdue' status is never set by a background job.
    // Rule: due_on_receipt → dueDate stays null; net_N → today + N calendar days.
    if (!body.dueDate) {
      const NET_DAYS: Record<string, number> = { net_15: 15, net_30: 30, net_60: 60 };
      const days = NET_DAYS[body.paymentTerms as string];
      if (days !== undefined) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        body.dueDate = d;
      }
    }

    const data = insertInvoiceSchema.parse(body);
    const inv = await invoicesRepository.create(data);
    res.status(201).json(inv);
  } catch (err: any) {
    // Sequence-backed numbering (invoice_number_seq) makes this collision essentially
    // impossible in normal operation. If it fires anyway (e.g. data patched externally),
    // surface a clear retryable message rather than a generic server error.
    if (err?.code === PG_UNIQUE_VIOLATION && err?.constraint === "invoices_invoice_number_unique") {
      return next(new ConflictError("Invoice number conflict — please retry."));
    }
    next(err);
  }
});

invoicesRouter.put("/api/invoices/:id", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return next(new ValidationError("Invalid invoice id"));
    const data = insertInvoiceSchema.partial().parse(req.body);
    if (data.status !== undefined) {
      const current = await invoicesRepository.getById(id);
      if (!current) return next(new NotFoundError("Invoice not found"));
      lifecycleService.validateInvoiceTransition(current.status, data.status);
    }
    if (data.status === "paid" && !(data as any).paidAt) {
      (data as any).paidAt = new Date();
    }
    const inv = await invoicesRepository.update(id, data);
    if (!inv) return next(new NotFoundError("Invoice not found"));
    res.json(inv);
  } catch (err) {
    // LifecycleError has .statusCode — handled by error middleware generic branch
    next(err);
  }
});

invoicesRouter.delete("/api/invoices/:id", requireRole("admin"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return next(new ValidationError("Invalid invoice id"));
    await invoicesRepository.delete(id);
    res.json({ message: "Invoice deleted" });
  } catch (err) {
    next(err);
  }
});
