import { Router } from "express";
import { requireAuth } from "../../core/middleware/auth.middleware";
import { dashboardRepository } from "./dashboard.repository";

export const dashboardRouter = Router();

// ─── Dashboard ──────────────────────────────────────────────────────────────
dashboardRouter.get("/api/dashboard/stats", requireAuth, async (_req, res) => {
  try {
    const stats = await dashboardRepository.getStats();
    res.json(stats);
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Failed to load dashboard stats" });
  }
});

dashboardRouter.get("/api/dashboard/my-stats", requireAuth, async (req, res) => {
  try {
    const tech = await dashboardRepository.getTechnicianByUserId(req.session.userId!);
    if (!tech) return res.status(404).json({ message: "No technician profile found" });
    const stats = await dashboardRepository.getMyStats(tech.id);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: "Failed to load stats" });
  }
});
