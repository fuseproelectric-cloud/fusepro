import { Router } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../../storage";
import { requireAuth } from "../../core/middleware/auth.middleware";
import { checkLoginRateLimit } from "../../core/middleware/rate-limit.middleware";

export const authRouter = Router();

// ─── Auth routes ────────────────────────────────────────────────────────────
authRouter.post("/api/auth/login", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    if (!checkLoginRateLimit(ip)) {
      return res.status(429).json({ message: "Too many login attempts. Try again in 15 minutes." });
    }
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const user = await storage.getUserByEmail(email.toLowerCase().trim());
    // Always run bcrypt.compare() regardless of whether the user was found.
    // Returning early on a missing user would create a measurable timing difference
    // (~100 ms for bcrypt vs ~1 ms for a DB miss) that leaks whether an email is registered.
    // The dummy hash is a real bcrypt digest; compare() takes the same time as a real check.
    const DUMMY_HASH = "$2b$12$vK7ozzC9hE2Gafr3WqZXzOgARFG2k1AMn50VfACTFP5tupX7h3ruy";
    const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
    if (!user || !valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

authRouter.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Session destroy error:", err);
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

authRouter.get("/api/auth/me", async (req, res) => {
  if (!req.session?.userId) {
    return res.status(200).json(null);
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user) {
    return res.status(200).json(null);
  }
  return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

// Change own password
authRouter.put("/api/auth/password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required" });
    }
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return res.status(404).json({ message: "User not found" });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ message: "Current password is incorrect" });
    const hashed = await bcrypt.hash(newPassword, 12);
    await storage.updateUser(user.id, { password: hashed });
    // Regenerate session to invalidate old tokens
    const userId = user.id;
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ message: "Failed to update password" });
      req.session.userId = userId;
      req.session.save(() => res.json({ message: "Password updated" }));
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to update password" });
  }
});
