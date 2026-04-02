/**
 * Unit tests for in-memory rate limiters.
 *
 * Each test uses a unique key (timestamp-suffixed) so test runs are fully
 * isolated from each other and from production state.
 */

import { describe, it, expect } from "vitest";
import {
  checkLoginRateLimit,
  checkUploadRateLimit,
  checkPasswordChangeRateLimit,
} from "../../server/core/middleware/rate-limit.middleware";

// ─── Login limiter ────────────────────────────────────────────────────────────

describe("checkLoginRateLimit (10 attempts / 15 min per IP)", () => {
  it("allows up to 10 attempts", () => {
    const ip = `login-allow-${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      expect(checkLoginRateLimit(ip)).toBe(true);
    }
  });

  it("blocks the 11th attempt", () => {
    const ip = `login-block-${Date.now()}`;
    for (let i = 0; i < 10; i++) checkLoginRateLimit(ip);
    expect(checkLoginRateLimit(ip)).toBe(false);
  });

  it("continues blocking beyond the limit", () => {
    const ip = `login-block2-${Date.now()}`;
    for (let i = 0; i < 10; i++) checkLoginRateLimit(ip);
    expect(checkLoginRateLimit(ip)).toBe(false);
    expect(checkLoginRateLimit(ip)).toBe(false);
  });

  it("tracks different IPs independently", () => {
    const ip1 = `login-ip1-${Date.now()}`;
    const ip2 = `login-ip2-${Date.now()}`;
    for (let i = 0; i < 10; i++) checkLoginRateLimit(ip1);
    expect(checkLoginRateLimit(ip1)).toBe(false);
    expect(checkLoginRateLimit(ip2)).toBe(true); // separate bucket
  });
});

// ─── Upload limiter ───────────────────────────────────────────────────────────

describe("checkUploadRateLimit (30 requests / hour per IP)", () => {
  it("allows up to 30 uploads", () => {
    const ip = `upload-allow-${Date.now()}`;
    for (let i = 0; i < 30; i++) {
      expect(checkUploadRateLimit(ip)).toBe(true);
    }
  });

  it("blocks the 31st upload", () => {
    const ip = `upload-block-${Date.now()}`;
    for (let i = 0; i < 30; i++) checkUploadRateLimit(ip);
    expect(checkUploadRateLimit(ip)).toBe(false);
  });

  it("tracks different IPs independently", () => {
    const ip1 = `upload-ip1-${Date.now()}`;
    const ip2 = `upload-ip2-${Date.now()}`;
    for (let i = 0; i < 30; i++) checkUploadRateLimit(ip1);
    expect(checkUploadRateLimit(ip1)).toBe(false);
    expect(checkUploadRateLimit(ip2)).toBe(true);
  });
});

// ─── Password-change limiter ──────────────────────────────────────────────────

describe("checkPasswordChangeRateLimit (5 attempts / 15 min per user ID)", () => {
  it("allows up to 5 attempts", () => {
    const key = `pw-allow-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkPasswordChangeRateLimit(key)).toBe(true);
    }
  });

  it("blocks the 6th attempt", () => {
    const key = `pw-block-${Date.now()}`;
    for (let i = 0; i < 5; i++) checkPasswordChangeRateLimit(key);
    expect(checkPasswordChangeRateLimit(key)).toBe(false);
  });

  it("tracks different user IDs independently", () => {
    const u1 = `pw-user1-${Date.now()}`;
    const u2 = `pw-user2-${Date.now()}`;
    for (let i = 0; i < 5; i++) checkPasswordChangeRateLimit(u1);
    expect(checkPasswordChangeRateLimit(u1)).toBe(false);
    expect(checkPasswordChangeRateLimit(u2)).toBe(true);
  });
});
