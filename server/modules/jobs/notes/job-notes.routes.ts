import { Router } from "express";
import { z } from "zod";
import type { Server as SocketServer } from "socket.io";
import { insertJobNoteSchema } from "@shared/schema";
import { requireAuth, requireJobAccess } from "../../../core/middleware/auth.middleware";
import { parseId } from "../../../core/utils/parse-id";
import { jobNotesRepository } from "./job-notes.repository";
import { usersRepository } from "../../users/users.repository";
import { notificationService } from "../../../services/notification.service";

export const jobNotesRouter = Router();

// ─── Job Notes ────────────────────────────────────────────────────────────────

jobNotesRouter.get("/api/jobs/:id/notes", requireAuth, requireJobAccess, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid job id" });
    const notes = await jobNotesRepository.getJobNotes(id);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: "Failed to load notes" });
  }
});

jobNotesRouter.put("/api/jobs/:id/notes/read", requireAuth, requireJobAccess, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid job id" });
    const { lastNoteId } = req.body;
    await jobNotesRepository.markJobNoteRead(req.session.userId!, id, Number(lastNoteId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark read" });
  }
});

jobNotesRouter.post("/api/jobs/:id/notes", requireAuth, requireJobAccess, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid job id" });
    const data = insertJobNoteSchema.parse({
      ...req.body,
      jobId: id,
      userId: req.session.userId,
    });
    const note = await jobNotesRepository.createJobNote(data);
    const sender = await usersRepository.getById(req.session.userId!);
    const enriched = { ...note, user: sender ? { id: sender.id, name: sender.name } : null };
    const io: SocketServer = (req.app as any).io;
    io?.to(`job:${data.jobId}`).emit("job:note", enriched);

    // Delegate all notification creation (DB persistence + realtime) to service
    await notificationService.notifyJobNote({
      jobId:   data.jobId,
      noteId:  note.id,
      content: data.content as string,
      sender:  sender ? { id: sender.id, name: sender.name } : null,
    });

    res.status(201).json(enriched);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to create note" });
  }
});
