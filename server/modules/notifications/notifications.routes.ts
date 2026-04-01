import { Router } from "express";
import { AppError } from "../../core/errors/app-error";
import { requireAuth } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { notificationsService } from "./notifications.service";

export const notificationsRouter = Router();

// ─── Notifications ──────────────────────────────────────────────────────────
notificationsRouter.get("/api/notifications", requireAuth, async (req, res) => {
  const notifs = await notificationsService.getUnread(req.session.userId!);
  res.json(notifs);
});

notificationsRouter.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new AppError("Invalid id", 400);
  await notificationsService.markRead(id, req.session.userId!);
  res.json({ ok: true });
});

notificationsRouter.put("/api/notifications/read-job/:jobId", requireAuth, async (req, res) => {
  const jobId = parseId(req.params.jobId);
  if (!jobId) throw new AppError("Invalid id", 400);
  await notificationsService.markJobRead(req.session.userId!, jobId);
  res.json({ ok: true });
});
