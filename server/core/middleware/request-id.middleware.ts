/**
 * Request ID middleware.
 *
 * Every HTTP request gets a correlation ID so that all log lines for the
 * same request can be grouped together. The ID is:
 *   - taken from the client's X-Request-ID header if valid (allows callers to
 *     propagate their own tracing ID into the server logs), OR
 *   - generated as a UUID v4 otherwise.
 *
 * Validation prevents log injection: only printable safe characters (alphanumeric,
 * hyphens, underscores, dots), max 64 chars.
 *
 * The ID is attached to `req.requestId` (typed via global Express augmentation)
 * and echoed back in the `X-Request-ID` response header so clients can correlate
 * their requests against server-side logs.
 */

import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

const SAFE_ID_RE = /^[a-zA-Z0-9\-_.]{1,64}$/;

// ─── Type augmentation ────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Correlation ID for this request. Always set by requestIdMiddleware. */
      requestId: string;
    }
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const fromHeader = req.headers["x-request-id"];
  const candidate  = typeof fromHeader === "string" ? fromHeader : undefined;
  const id         = (candidate && SAFE_ID_RE.test(candidate)) ? candidate : randomUUID();

  req.requestId = id;
  res.setHeader("X-Request-ID", id);
  next();
}
