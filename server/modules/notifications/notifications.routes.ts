import { Router } from "express";
import { requireAuth } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { notificationsRepository } from "./notifications.repository";

export const notificationsRouter = Router();

// ─── Notifications ──────────────────────────────────────────────────────────
notificationsRouter.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const notifs = await notificationsRepository.getUnread(req.session.userId!);
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ message: "Failed to load notifications" });
  }
});

notificationsRouter.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const updated = await notificationsRepository.markRead(id, req.session.userId!);
    if (!updated) return res.status(404).json({ message: "Notification not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark notification read" });
  }
});

notificationsRouter.put("/api/notifications/read-job/:jobId", requireAuth, async (req, res) => {
  try {
    const jobId = parseId(req.params.jobId);
    if (!jobId) return res.status(400).json({ message: "Invalid id" });
    await notificationsRepository.markJobRead(req.session.userId!, jobId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark notifications read" });
  }
});
