import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { Server as SocketServer } from "socket.io";
import { requireAuth, requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { conversationsRepository } from "./conversations.repository";
import { usersRepository } from "../users/users.repository";
import {
  canRenameConversation,
  canManageConversationMembers,
  canCreateConversationType,
} from "../../core/policies/conversations.policy";

/**
 * Verifies the authenticated user is a member of the conversation in :id.
 * Returns 403 if not a member, 400 if the conversation id is invalid.
 */
async function requireConvMembership(req: Request, res: Response, next: NextFunction) {
  const convId = parseId(req.params.id);
  if (!convId) return res.status(400).json({ message: "Invalid conversation id" });
  const members = await conversationsRepository.getConvMembers(convId);
  if (!members.some(m => m.id === req.session.userId)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

export const conversationsRouter = Router();

// ─── Conversations ────────────────────────────────────────────────────────────

// job-list must be registered before /:id to avoid "job-list" being parsed as an ID
conversationsRouter.get("/api/conversations/job-list", requireAuth, async (req, res) => {
  try {
    const user = await usersRepository.getById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const list = await conversationsRepository.getJobChatList(user.id, user.role);
    res.json(list);
  } catch (err) {
    console.error("job chat list error:", err);
    res.status(500).json({ message: "Failed to load job chats" });
  }
});

conversationsRouter.get("/api/conversations", requireAuth, async (req, res) => {
  try {
    const list = await conversationsRepository.getConversationsForUser(req.session.userId!);
    res.json(list);
  } catch (err) {
    console.error("conversations list error:", err);
    res.status(500).json({ message: "Failed to load conversations" });
  }
});

conversationsRouter.post("/api/conversations", requireAuth, async (req, res) => {
  try {
    const { type, name, memberIds, jobId } = req.body;
    if (!type) return res.status(400).json({ message: "type required" });
    const user = await usersRepository.getById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!canCreateConversationType(user, type)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const conv = await conversationsRepository.createConversation({
      type, name, jobId, createdBy: req.session.userId!, memberIds: memberIds ?? [],
    });
    res.status(201).json(conv);
  } catch (err) {
    res.status(500).json({ message: "Failed to create conversation" });
  }
});

// direct must be registered before /:id
conversationsRouter.post("/api/conversations/direct/:userId", requireAuth, async (req, res) => {
  try {
    const userId = parseId(req.params.userId);
    if (!userId) return res.status(400).json({ message: "Invalid user id" });
    const conv = await conversationsRepository.getOrCreateDirectConversation(req.session.userId!, userId);
    res.json(conv);
  } catch (err) {
    res.status(500).json({ message: "Failed to get/create DM" });
  }
});

conversationsRouter.get("/api/conversations/:id/messages", requireAuth, requireConvMembership, async (req, res) => {
  try {
    const convId = parseId(req.params.id);
    if (!convId) return res.status(400).json({ message: "Invalid conversation id" });
    const beforeRaw = req.query.before ? Number(req.query.before) : undefined;
    const before = beforeRaw !== undefined && Number.isFinite(beforeRaw) ? beforeRaw : undefined;
    const msgs = await conversationsRepository.getConvMessages(convId, 60, before);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ message: "Failed to load messages" });
  }
});

conversationsRouter.post("/api/conversations/:id/messages", requireAuth, requireConvMembership, async (req, res) => {
  try {
    const convId = parseId(req.params.id);
    if (!convId) return res.status(400).json({ message: "Invalid conversation id" });
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "Content required" });
    const msg = await conversationsRepository.createConvMessage(convId, req.session.userId!, content.trim());
    const io: SocketServer = (req.app as any).io;
    io?.to(`conv:${convId}`).emit("conv:message", msg);
    // Also notify members not in the room via their personal socket room
    const members = await conversationsRepository.getConvMembers(convId);
    members.forEach(m => {
      if (m.id !== req.session.userId) {
        io?.to(`user:${m.id}`).emit("conv:unread", { conversationId: convId });
      }
    });
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: "Failed to send message" });
  }
});

conversationsRouter.put("/api/conversations/:id/read", requireAuth, requireConvMembership, async (req, res) => {
  try {
    const convId = parseId(req.params.id);
    if (!convId) return res.status(400).json({ message: "Invalid conversation id" });
    const { lastId } = req.body;
    if (lastId) await conversationsRepository.markConvRead(convId, req.session.userId!, Number(lastId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark read" });
  }
});

conversationsRouter.put("/api/conversations/:id/name", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const convId = parseId(req.params.id);
    if (!convId) return res.status(400).json({ message: "Invalid conversation id" });
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Name required" });
    await conversationsRepository.updateConversationName(convId, name.trim());
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to rename" });
  }
});

conversationsRouter.post("/api/conversations/:id/members", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const convId = parseId(req.params.id);
    const userId = parseId(req.body.userId);
    if (!convId || !userId) return res.status(400).json({ message: "Invalid conversation or user id" });
    await conversationsRepository.addConvMember(convId, userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to add member" });
  }
});

conversationsRouter.delete("/api/conversations/:id/members/:userId", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const convId = parseId(req.params.id);
    const userId = parseId(req.params.userId);
    if (!convId || !userId) return res.status(400).json({ message: "Invalid conversation or user id" });
    await conversationsRepository.removeConvMember(convId, userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove member" });
  }
});
