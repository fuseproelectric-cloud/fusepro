import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error";

export function errorMiddleware(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof z.ZodError) {
    res.status(400).json({ message: err.errors });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) console.error("App Error:", err);
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if (err instanceof URIError) {
    res.status(400).json({ message: "Bad Request" });
    return;
  }

  // Honour status/statusCode from third-party middleware errors (e.g. express-session)
  const anyErr = err as any;
  const status: number = anyErr?.status || anyErr?.statusCode;
  if (status && status >= 100 && status < 600) {
    res.status(status).json({ message: anyErr?.message || "Error" });
    return;
  }

  console.error("Server Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
}
