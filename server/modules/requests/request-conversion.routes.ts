import { Router } from "express";
import { Server as SocketServer } from "socket.io";
import { requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { requestConversionService, ConversionError } from "../../services/request-conversion.service";
import { storage } from "../../storage";

export const requestConversionRouter = Router();

// ─── Request Conversion ───────────────────────────────────────────────────────

requestConversionRouter.post("/api/requests/:id/convert-estimate", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const requestId = parseId(req.params.id);
    if (!requestId) return res.status(400).json({ message: "Invalid request id" });
    const io: SocketServer = (req.app as any).io;
    const result = await requestConversionService.toEstimate({
      requestId,
      performedBy: req.session.userId!,
      io,
    });
    return res.status(201).json(result.entity);
  } catch (err) {
    if (err instanceof ConversionError) return res.status(err.statusCode).json({ message: err.message });
    console.error("Request → Estimate conversion error:", err);
    return res.status(500).json({ message: "Failed to convert request to estimate" });
  }
});

requestConversionRouter.post("/api/requests/:id/convert-job", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const requestId = parseId(req.params.id);
    if (!requestId) return res.status(400).json({ message: "Invalid request id" });
    const io: SocketServer = (req.app as any).io;
    const result = await requestConversionService.toJob({
      requestId,
      performedBy: req.session.userId!,
      io,
    });
    return res.status(201).json(result.entity);
  } catch (err) {
    if (err instanceof ConversionError) return res.status(err.statusCode).json({ message: err.message });
    console.error("Request → Job conversion error:", err);
    return res.status(500).json({ message: "Failed to convert request to job" });
  }
});

// Returns { type: "estimate" | "job", id: number } for a converted request.
// Used by the UI to build a "View Estimate / View Job" deep link.
requestConversionRouter.get("/api/requests/:id/converted-entity", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const requestId = parseId(req.params.id);
    if (!requestId) return res.status(400).json({ message: "Invalid request id" });
    const reqItem = await storage.getRequestById(requestId);
    if (!reqItem) return res.status(404).json({ message: "Request not found" });
    if (reqItem.status !== "converted" || !reqItem.convertedToType) {
      return res.status(404).json({ message: "Request has not been converted" });
    }
    const entity = reqItem.convertedToType === "estimate"
      ? await storage.getEstimateByRequestId(requestId)
      : await storage.getJobByRequestId(requestId);
    if (!entity) return res.status(404).json({ message: "Converted entity not found" });
    res.json({ type: reqItem.convertedToType, id: entity.id });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch converted entity" });
  }
});
