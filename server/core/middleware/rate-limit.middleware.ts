/**
 * Lightweight in-memory rate limiters.
 *
 * Each limiter is a closure over its own Map — no shared state between limiters.
 * Works for single-instance deployments. For multi-instance / load-balanced
 * deployments a distributed store (Redis, etc.) would be needed.
 *
 * The cleanup interval for each limiter matches its window so expired entries
 * are pruned on a predictable schedule without holding memory indefinitely.
 */

function makeRateLimiter(maxAttempts: number, windowMs: number) {
  const store = new Map<string, { count: number; resetAt: number }>();

  // Prune expired entries on the same cadence as the window.
  setInterval(() => {
    const now = Date.now();
    Array.from(store).forEach(([key, entry]) => {
      if (now > entry.resetAt) store.delete(key);
    });
  }, windowMs);

  return function check(key: string): boolean {
    const now = Date.now();
    const entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= maxAttempts) return false;
    entry.count++;
    return true;
  };
}

// ─── Limiters ─────────────────────────────────────────────────────────────────

/** Login: 10 attempts per IP per 15 minutes. */
export const checkLoginRateLimit = makeRateLimiter(10, 15 * 60 * 1000);

/**
 * Upload: 30 requests per IP per hour.
 * Generous enough for normal photo uploads; limits storage/bandwidth abuse.
 */
export const checkUploadRateLimit = makeRateLimiter(30, 60 * 60 * 1000);

/**
 * Password change: 5 attempts per user ID per 15 minutes.
 * Keyed by user ID (not IP) so a single account cannot be brute-forced
 * from multiple IPs.
 */
export const checkPasswordChangeRateLimit = makeRateLimiter(5, 15 * 60 * 1000);
