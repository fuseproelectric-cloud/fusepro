import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { Server as SocketServer } from "socket.io";
import { requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { requestConversionService } from "../../services/request-conversion.service";
import { storage } from "../../storage";
import { ValidationError, NotFoundError } from "../../core/errors/app-error";

export const requestConversionRouter = Router();

// ─── Request Conversion ───────────────────────────────────────────────────────

requestConversionRouter.post("/api/requests/:id/convert-estimate", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = parseId(req.params.id);
    if (!requestId) return next(new ValidationError("Invalid request id"));
    const io: SocketServer = (req.app as any).io;
    const result = await requestConversionService.toEstimate({
      requestId,
      performedBy: req.session.userId!,
      io,
    });
    return res.status(201).json(result.entity);
  } catch (err) {
    // ConversionError extends AppError — handled by error middleware
    next(err);
  }
});

requestConversionRouter.post("/api/requests/:id/convert-job", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = parseId(req.params.id);
    if (!requestId) return next(new ValidationError("Invalid request id"));
    const io: SocketServer = (req.app as any).io;
    const result = await requestConversionService.toJob({
      requestId,
      performedBy: req.session.userId!,
      io,
    });
    return res.status(201).json(result.entity);
  } catch (err) {
    // ConversionError extends AppError — handled by error middleware
    next(err);
  }
});

// Returns { type: "estimate" | "job", id: number } for a converted request.
// Used by the UI to build a "View Estimate / View Job" deep link.
requestConversionRouter.get("/api/requests/:id/converted-entity", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = parseId(req.params.id);
    if (!requestId) return next(new ValidationError("Invalid request id"));
    const reqItem = await storage.getRequestById(requestId);
    if (!reqItem) return next(new NotFoundError("Request not found"));
    if (reqItem.status !== "converted" || !reqItem.convertedToType) {
      return next(new NotFoundError("Request has not been converted"));
    }
    const entity = reqItem.convertedToType === "estimate"
      ? await storage.getEstimateByRequestId(requestId)
      : await storage.getJobByRequestId(requestId);
    if (!entity) return next(new NotFoundError("Converted entity not found"));
    res.json({ type: reqItem.convertedToType, id: entity.id });
  } catch (err) {
    next(err);
  }
});
