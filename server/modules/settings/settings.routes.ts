import { Router } from "express";
import { storage } from "../../storage";
import { requireRole } from "../../core/middleware/auth.middleware";

export const settingsRouter = Router();

// ─── Settings ────────────────────────────────────────────────────────────────
settingsRouter.get("/api/settings", requireRole("admin"), async (_req, res) => {
  try {
    const data = await storage.getAllSettings();
    const map: Record<string, string> = {};
    data.forEach((s) => { if (s.key && s.value) map[s.key] = s.value; });
    res.json(map);
  } catch (err) {
    res.status(500).json({ message: "Failed to load settings" });
  }
});

settingsRouter.put("/api/settings/:key", requireRole("admin"), async (req, res) => {
  try {
    const value: string = String(req.body.value);
    const setting = await storage.upsertSetting(req.params.key as string, value);
    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: "Failed to update setting" });
  }
});
