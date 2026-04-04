import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { Server as SocketServer } from "socket.io";
import { requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { estimateConversionService } from "../../services/estimate-conversion.service";
import { ValidationError } from "../../core/errors/app-error";

export const estimateConversionRouter = Router();

// ─── Estimate → Invoice conversion ───────────────────────────────────────────
// Thin handler — all orchestration is owned by EstimateConversionService.
// Returns the created invoice only; estimate status update is reflected via
// client-side query invalidation of /api/estimates.
estimateConversionRouter.post("/api/estimates/:id/convert-invoice", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const estimateId = parseId(req.params.id);
    if (!estimateId) return next(new ValidationError("Invalid estimate id"));
    const io: SocketServer = (req.app as any).io;
    const result = await estimateConversionService.toInvoice({
      estimateId,
      performedBy: req.session.userId!,
      paymentTerms: req.body?.paymentTerms,
      io,
      traceId: req.requestId,
    });
    return res.status(201).json(result.invoice);
  } catch (err) {
    // InvoiceConversionError extends AppError — handled by error middleware
    next(err);
  }
});
