import { Router } from "express";
import { requireAuth } from "../../core/middleware/auth.middleware";
import { dashboardService } from "./dashboard.service";

export const dashboardRouter = Router();

// ─── Dashboard ──────────────────────────────────────────────────────────────
dashboardRouter.get("/api/dashboard/stats", requireAuth, async (_req, res) => {
  const stats = await dashboardService.getStats();
  res.json(stats);
});

dashboardRouter.get("/api/dashboard/my-stats", requireAuth, async (req, res) => {
  const stats = await dashboardService.getMyStats(req.session.userId!);
  res.json(stats);
});
