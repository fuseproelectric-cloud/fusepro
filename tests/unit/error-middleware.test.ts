/**
 * Unit tests for the error middleware.
 *
 * Covers:
 *   - request_id is included in all error response shapes
 *   - AppError subclasses produce correct status + code
 *   - ZodError produces VALIDATION_ERROR with request_id
 *   - Unhandled exceptions produce INTERNAL_ERROR with request_id
 *   - 5xx AppErrors are logged at error level; 4xx are logged at warn level
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { errorMiddleware } from "../../server/core/middleware/error.middleware";
import {
  AppError, ValidationError, AuthError, ForbiddenError, NotFoundError,
} from "../../server/core/errors/app-error";

// ─── Mock logger ──────────────────────────────────────────────────────────────

vi.mock("../../server/core/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from "../../server/core/utils/logger";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REQUEST_ID = "test-req-id-abc";

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    requestId: REQUEST_ID,
    method:    "GET",
    path:      "/api/test",
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; statusFn: ReturnType<typeof vi.fn>; jsonFn: ReturnType<typeof vi.fn> } {
  const jsonFn   = vi.fn();
  const statusFn = vi.fn().mockReturnValue({ json: jsonFn });
  const res = {
    headersSent: false,
    status:      statusFn,
    json:        jsonFn,
  } as unknown as Response;
  // Make res.status(x).json(...) work: status returns res itself
  statusFn.mockReturnValue(res);
  return { res, statusFn, jsonFn };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("errorMiddleware — request_id propagation", () => {
  const next: NextFunction = vi.fn();

  it("includes request_id in AppError (4xx) response", () => {
    const { res, jsonFn } = makeRes();
    errorMiddleware(new NotFoundError("Item not found"), makeReq(), res, next);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ request_id: REQUEST_ID }) }),
    );
  });

  it("includes request_id in AppError (5xx) response", () => {
    const { res, jsonFn } = makeRes();
    errorMiddleware(new AppError("server issue", 500, "SERVER_ISSUE"), makeReq(), res, next);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ request_id: REQUEST_ID }) }),
    );
  });

  it("includes request_id in ZodError response", () => {
    const { res, jsonFn } = makeRes();
    let zodErr: z.ZodError;
    try { z.string().parse(42); } catch (e) { zodErr = e as z.ZodError; }
    errorMiddleware(zodErr!, makeReq(), res, next);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "VALIDATION_ERROR", request_id: REQUEST_ID }) }),
    );
  });

  it("includes request_id in unhandled exception response", () => {
    const { res, jsonFn } = makeRes();
    errorMiddleware(new Error("unexpected"), makeReq(), res, next);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "INTERNAL_ERROR", request_id: REQUEST_ID }) }),
    );
  });

  it("includes request_id in URIError response", () => {
    const { res, jsonFn } = makeRes();
    errorMiddleware(new URIError("bad uri"), makeReq(), res, next);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "BAD_REQUEST", request_id: REQUEST_ID }) }),
    );
  });
});

describe("errorMiddleware — status codes and error codes", () => {
  const next: NextFunction = vi.fn();
  beforeEach(() => {
    (logger.error as ReturnType<typeof vi.fn>).mockClear();
    (logger.warn  as ReturnType<typeof vi.fn>).mockClear();
  });

  it("maps AuthError → 401 UNAUTHORIZED", () => {
    const { res, statusFn } = makeRes();
    errorMiddleware(new AuthError(), makeReq(), res, next);
    expect(statusFn).toHaveBeenCalledWith(401);
  });

  it("maps ForbiddenError → 403 FORBIDDEN", () => {
    const { res, statusFn } = makeRes();
    errorMiddleware(new ForbiddenError(), makeReq(), res, next);
    expect(statusFn).toHaveBeenCalledWith(403);
  });

  it("maps NotFoundError → 404 NOT_FOUND", () => {
    const { res, statusFn } = makeRes();
    errorMiddleware(new NotFoundError(), makeReq(), res, next);
    expect(statusFn).toHaveBeenCalledWith(404);
  });

  it("maps ValidationError → 400 VALIDATION_ERROR", () => {
    const { res, statusFn, jsonFn } = makeRes();
    errorMiddleware(new ValidationError("bad input"), makeReq(), res, next);
    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "VALIDATION_ERROR" }) }),
    );
  });

  it("logs 5xx AppErrors at error level", () => {
    const { res } = makeRes();
    errorMiddleware(new AppError("server fail", 500, "SERVER_FAIL"), makeReq(), res, next);
    expect(logger.error).toHaveBeenCalledWith("App error", expect.objectContaining({ request_id: REQUEST_ID }));
  });

  it("logs 4xx AppErrors at warn level (not error)", () => {
    const { res } = makeRes();
    errorMiddleware(new NotFoundError("missing"), makeReq(), res, next);
    expect(logger.warn).toHaveBeenCalledWith("App error", expect.objectContaining({ request_id: REQUEST_ID }));
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe("errorMiddleware — headers already sent", () => {
  it("delegates to next() when headers are already sent", () => {
    const err  = new Error("late error");
    const req  = makeReq();
    const res  = { headersSent: true } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    errorMiddleware(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
