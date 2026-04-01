// Simple in-memory login rate limiter: max 10 attempts per IP per 15 minutes
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// Cleanup stale entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  Array.from(loginAttempts).forEach(([ip, entry]) => {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  });
}, 15 * 60 * 1000);
