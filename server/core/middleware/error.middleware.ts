import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error";
import { logger } from "../utils/logger";

export function errorMiddleware(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const requestId = req.requestId; // always set by requestIdMiddleware

  if (err instanceof z.ZodError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: err.errors, request_id: requestId } });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error("App error", {
        source:     "error",
        request_id: requestId,
        code:       err.code,
        status:     err.statusCode,
        method:     req.method,
        path:       req.path,
        message:    err.message,
      });
    } else {
      logger.warn("App error", {
        source:     "error",
        request_id: requestId,
        code:       err.code,
        status:     err.statusCode,
        method:     req.method,
        path:       req.path,
      });
    }
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message, request_id: requestId } });
    return;
  }

  if (err instanceof URIError) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Bad Request", request_id: requestId } });
    return;
  }

  // Honour status/statusCode from third-party middleware errors (e.g. express-session)
  const anyErr = err as any;
  const status: number = anyErr?.status || anyErr?.statusCode;
  if (status && status >= 100 && status < 600) {
    res.status(status).json({ error: { code: "ERROR", message: anyErr?.message || "Error", request_id: requestId } });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error("Unhandled exception", {
    source:     "error",
    request_id: requestId,
    method:     req.method,
    path:       req.path,
    message,
    ...(process.env.NODE_ENV !== "production" && err instanceof Error
      ? { stack: err.stack?.split("\n")[1]?.trim() }
      : {}),
  });
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal Server Error", request_id: requestId } });
}
