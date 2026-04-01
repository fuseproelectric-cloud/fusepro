import { Router } from "express";
import { Server as SocketServer } from "socket.io";
import { requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { estimateConversionService } from "../../services/estimate-conversion.service";
import { ConversionError } from "../../services/request-conversion.service";

export const estimateConversionRouter = Router();

// ─── Estimate → Invoice conversion ───────────────────────────────────────────
// Thin handler — all orchestration is owned by EstimateConversionService.
// Returns the created invoice only; estimate status update is reflected via
// client-side query invalidation of /api/estimates.
estimateConversionRouter.post("/api/estimates/:id/convert-invoice", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const estimateId = parseId(req.params.id);
    if (!estimateId) return res.status(400).json({ message: "Invalid estimate id" });
    const io: SocketServer = (req.app as any).io;
    const result = await estimateConversionService.toInvoice({
      estimateId,
      performedBy: req.session.userId!,
      paymentTerms: req.body?.paymentTerms,
      io,
    });
    return res.status(201).json(result.invoice);
  } catch (err) {
    if (err instanceof ConversionError) return res.status(err.statusCode).json({ message: err.message });
    console.error("Estimate → Invoice conversion error:", err);
    return res.status(500).json({ message: "Failed to convert estimate to invoice" });
  }
});
