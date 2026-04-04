/**
 * Unit tests for the request ID middleware.
 *
 * Covers:
 *   - UUID generation when no header is present
 *   - Reuse of a valid client-supplied X-Request-ID
 *   - Rejection (new UUID generated) for invalid header values
 *   - Response header is always set to the assigned ID
 *   - next() is always called
 */

import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requestIdMiddleware } from "../../server/core/middleware/request-id.middleware";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}
function makeRes(): { res: Response; setHeader: ReturnType<typeof vi.fn> } {
  const setHeader = vi.fn();
  return { res: { setHeader } as unknown as Response, setHeader };
}

describe("requestIdMiddleware", () => {
  it("generates a UUID when no X-Request-ID header is present", () => {
    const req  = makeReq();
    const { res, setHeader } = makeRes();
    const next: NextFunction = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toMatch(UUID_RE);
    expect(setHeader).toHaveBeenCalledWith("X-Request-ID", req.requestId);
    expect(next).toHaveBeenCalledOnce();
  });

  it("reuses a valid alphanumeric client-supplied request ID", () => {
    const req  = makeReq({ "x-request-id": "client-id-abc-123" });
    const { res, setHeader } = makeRes();
    const next: NextFunction = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe("client-id-abc-123");
    expect(setHeader).toHaveBeenCalledWith("X-Request-ID", "client-id-abc-123");
  });

  it("reuses a valid UUID-format header", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const req  = makeReq({ "x-request-id": uuid });
    const { res } = makeRes();
    requestIdMiddleware(req, res, vi.fn());
    expect(req.requestId).toBe(uuid);
  });

  it("generates a new UUID when the header contains invalid characters", () => {
    const req  = makeReq({ "x-request-id": "<script>xss</script>" });
    const { res } = makeRes();
    requestIdMiddleware(req, res, vi.fn());
    expect(req.requestId).not.toBe("<script>xss</script>");
    expect(req.requestId).toMatch(UUID_RE);
  });

  it("generates a new UUID when the header exceeds 64 characters", () => {
    const longId = "a".repeat(65);
    const req    = makeReq({ "x-request-id": longId });
    const { res } = makeRes();
    requestIdMiddleware(req, res, vi.fn());
    expect(req.requestId).not.toBe(longId);
    expect(req.requestId).toMatch(UUID_RE);
  });

  it("generates a new UUID when the header is exactly 64 characters (boundary — valid)", () => {
    const id64 = "a".repeat(64);
    const req  = makeReq({ "x-request-id": id64 });
    const { res } = makeRes();
    requestIdMiddleware(req, res, vi.fn());
    expect(req.requestId).toBe(id64);
  });

  it("echoes the assigned ID back in X-Request-ID response header", () => {
    const req  = makeReq({ "x-request-id": "echo-me" });
    const { res, setHeader } = makeRes();
    requestIdMiddleware(req, res, vi.fn());
    expect(setHeader).toHaveBeenCalledWith("X-Request-ID", "echo-me");
  });

  it("always calls next()", () => {
    const next: NextFunction = vi.fn();
    requestIdMiddleware(makeReq(), makeRes().res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(); // called with no args (not an error)
  });

  it("two concurrent requests get different generated IDs", () => {
    const req1 = makeReq();
    const req2 = makeReq();
    requestIdMiddleware(req1, makeRes().res, vi.fn());
    requestIdMiddleware(req2, makeRes().res, vi.fn());
    expect(req1.requestId).not.toBe(req2.requestId);
  });
});
