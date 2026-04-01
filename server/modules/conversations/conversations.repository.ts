import { eq, desc, and, lt, sql, inArray } from "drizzle-orm";
import { db } from "../../db";
import {
  conversations, conversationMembers, convMessages, users,
  jobs, jobNotes, jobNoteReads,
} from "@shared/schema";
import type { Conversation, ConvMessage, Job } from "@shared/schema";
import { techniciansRepository } from "../technicians/technicians.repository";
import { usersRepository } from "../users/users.repository";

export const conversationsRepository = {
  async getConversationsForUser(userId: number): Promise<Array<{
    id: number; type: string; name: string | null; jobId: number | null;
    lastMessage: string | null; lastMessageAt: string | null;
    unreadCount: number; memberCount: number;
    members: Array<{ id: number; name: string; role: string }>;
  }>> {
    // Get conversations where user is a member
    const memberRows = await db
      .select({ convId: conversationMembers.conversationId, lastReadId: conversationMembers.lastReadId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));

    if (memberRows.length === 0) return [];

    const convIds = memberRows.map(r => r.convId);
    const readMap: Record<number, number> = {};
    memberRows.forEach(r => { readMap[r.convId] = r.lastReadId; });

    const convRows = await db
      .select()
      .from(conversations)
      .where(inArray(conversations.id, convIds));

    // Batch: fetch all messages for these conversations once, sorted desc.
    // Used for both last-message-per-conversation and unread counts.
    // Drizzle ORM inArray handles integer typing correctly — no raw SQL needed.
    const allMsgs = await db
      .select({
        id: convMessages.id,
        conversationId: convMessages.conversationId,
        userId: convMessages.userId,
        content: convMessages.content,
        createdAt: convMessages.createdAt,
      })
      .from(convMessages)
      .where(inArray(convMessages.conversationId, convIds))
      .orderBy(desc(convMessages.id));

    // Derive last message map and unread counts in a single JS pass
    const lastMsgMap: Record<number, { content: string; createdAt: Date }> = {};
    const unreadMap: Record<number, number> = {};
    for (const r of allMsgs) {
      if (!(r.conversationId in lastMsgMap)) {
        lastMsgMap[r.conversationId] = { content: r.content, createdAt: r.createdAt };
      }
      if (r.id > (readMap[r.conversationId] ?? 0) && r.userId !== userId) {
        unreadMap[r.conversationId] = (unreadMap[r.conversationId] ?? 0) + 1;
      }
    }

    // Batch: all members for all conversations (1 query)
    const allMemberRows = await db
      .select({ convId: conversationMembers.conversationId, id: users.id, name: users.name, role: users.role })
      .from(conversationMembers)
      .innerJoin(users, eq(conversationMembers.userId, users.id))
      .where(inArray(conversationMembers.conversationId, convIds));
    const membersMap: Record<number, Array<{ id: number; name: string; role: string }>> = {};
    for (const r of allMemberRows) {
      if (!membersMap[r.convId]) membersMap[r.convId] = [];
      membersMap[r.convId].push({ id: r.id, name: r.name, role: r.role });
    }

    const result = convRows.map(conv => {
      const lastMsg = lastMsgMap[conv.id];
      const memberList = membersMap[conv.id] ?? [];
      return {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        jobId: conv.jobId,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.createdAt ? new Date(lastMsg.createdAt).toISOString() : null,
        unreadCount: unreadMap[conv.id] ?? 0,
        memberCount: memberList.length,
        members: memberList,
      };
    });

    return result.sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (a.type === "team") return -1; // team conversation always first
      if (b.type === "team") return 1;
      return tb - ta;
    });
  },

  async getConversationById(id: number): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conv;
  },

  async updateConversationName(id: number, name: string): Promise<void> {
    await db.update(conversations).set({ name }).where(eq(conversations.id, id));
  },

  async createConversation(data: {
    type: string; name?: string; jobId?: number; createdBy: number; memberIds: number[];
  }): Promise<Conversation> {
    const [conv] = await db.insert(conversations).values({
      type: data.type,
      name: data.name ?? null,
      jobId: data.jobId ?? null,
      createdBy: data.createdBy,
    }).returning();

    // Add members
    const uniqueIds = Array.from(new Set([data.createdBy, ...data.memberIds]));
    await db.insert(conversationMembers).values(
      uniqueIds.map(uid => ({ conversationId: conv.id, userId: uid }))
    ).onConflictDoNothing();

    return conv;
  },

  async getOrCreateDirectConversation(userId1: number, userId2: number): Promise<Conversation> {
    // Find existing direct conversation between exactly these two users
    const existing = await db.execute(sql`
      SELECT c.id FROM conversations c
      WHERE c.type = 'direct'
        AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ${userId1})
        AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ${userId2})
        AND (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) = 2
      LIMIT 1
    `);
    if (existing.rows.length > 0) {
      const [conv] = await db.select().from(conversations).where(eq(conversations.id, Number((existing.rows[0] as any).id)));
      return conv;
    }
    return conversationsRepository.createConversation({ type: "direct", createdBy: userId1, memberIds: [userId2] });
  },

  async getConvMessages(conversationId: number, limit = 60, before?: number): Promise<(ConvMessage & { userName: string; userRole: string })[]> {
    const rows = await db
      .select({ msg: convMessages, name: users.name, role: users.role })
      .from(convMessages)
      .innerJoin(users, eq(convMessages.userId, users.id))
      .where(and(
        eq(convMessages.conversationId, conversationId),
        before ? lt(convMessages.id, before) : undefined,
      ))
      .orderBy(desc(convMessages.id))
      .limit(limit);
    return rows.reverse().map(r => ({ ...r.msg, userName: r.name, userRole: r.role }));
  },

  async createConvMessage(conversationId: number, userId: number, content: string): Promise<ConvMessage & { userName: string; userRole: string }> {
    const [msg] = await db.insert(convMessages).values({ conversationId, userId, content }).returning();
    const user = await usersRepository.getById(userId);
    return { ...msg, userName: user?.name ?? "Unknown", userRole: user?.role ?? "technician" };
  },

  async markConvRead(conversationId: number, userId: number, lastId: number): Promise<void> {
    await db
      .update(conversationMembers)
      .set({ lastReadId: lastId })
      .where(and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ));
  },

  async getConvMembers(conversationId: number): Promise<Array<{ id: number; name: string; role: string }>> {
    return db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(conversationMembers)
      .innerJoin(users, eq(conversationMembers.userId, users.id))
      .where(eq(conversationMembers.conversationId, conversationId));
  },

  async addConvMember(conversationId: number, userId: number): Promise<void> {
    await db.insert(conversationMembers).values({ conversationId, userId }).onConflictDoNothing();
  },

  async removeConvMember(conversationId: number, userId: number): Promise<void> {
    await db.delete(conversationMembers).where(and(
      eq(conversationMembers.conversationId, conversationId),
      eq(conversationMembers.userId, userId),
    ));
  },

  async ensureTeamMember(userId: number): Promise<void> {
    const [teamConv] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.type, "team"))
      .limit(1);
    if (!teamConv) return; // team conversation not yet bootstrapped
    await db
      .insert(conversationMembers)
      .values({ conversationId: teamConv.id, userId })
      .onConflictDoNothing();
  },

  async getJobChatList(userId: number, role: string): Promise<Array<{
    jobId: number; title: string; status: string;
    lastMessage: string | null; lastMessageAt: string | null; unreadCount: number;
  }>> {
    let jobRows: Job[];
    if (role === "technician") {
      const tech = await techniciansRepository.getByUserId(userId);
      jobRows = tech
        ? await db.select().from(jobs).where(eq(jobs.technicianId, tech.id)).orderBy(desc(jobs.scheduledAt))
        : [];
    } else {
      jobRows = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    }

    if (jobRows.length === 0) return [];
    const jobIds = jobRows.map(j => j.id);

    // Batch: all notes for these jobs sorted desc.
    // Used for both last-note-per-job and unread counts.
    const allNotes = await db
      .select({ jobId: jobNotes.jobId, id: jobNotes.id, userId: jobNotes.userId, content: jobNotes.content, createdAt: jobNotes.createdAt })
      .from(jobNotes)
      .where(inArray(jobNotes.jobId, jobIds))
      .orderBy(desc(jobNotes.id));
    const lastNoteMap: Record<number, { id: number; content: string; createdAt: Date }> = {};
    for (const r of allNotes) {
      if (!(r.jobId in lastNoteMap)) {
        lastNoteMap[r.jobId] = { id: r.id, content: r.content, createdAt: r.createdAt };
      }
    }

    // Only process jobs that have at least one note
    const activeJobIds = jobIds.filter(id => lastNoteMap[id]);
    if (activeJobIds.length === 0) return [];

    // Batch: read thresholds for this user (1 query)
    const readRows = await db
      .select({ jobId: jobNoteReads.jobId, lastReadNoteId: jobNoteReads.lastReadNoteId })
      .from(jobNoteReads)
      .where(and(eq(jobNoteReads.userId, userId), inArray(jobNoteReads.jobId, activeJobIds)));
    const readMap: Record<number, number> = {};
    for (const r of readRows) readMap[r.jobId] = r.lastReadNoteId;

    // Derive unread counts in JS from allNotes + readMap
    const unreadMap: Record<number, number> = {};
    for (const r of allNotes) {
      if (r.id > (readMap[r.jobId] ?? 0) && r.userId !== userId) {
        unreadMap[r.jobId] = (unreadMap[r.jobId] ?? 0) + 1;
      }
    }

    const jobMap: Record<number, Job> = {};
    for (const j of jobRows) jobMap[j.id] = j;

    return activeJobIds
      .map(jobId => {
        const lastNote = lastNoteMap[jobId];
        const job = jobMap[jobId];
        return {
          jobId: job.id,
          title: job.title,
          status: job.status,
          lastMessage: lastNote.content.slice(0, 80),
          lastMessageAt: lastNote.createdAt ? new Date(lastNote.createdAt).toISOString() : null,
          unreadCount: unreadMap[jobId] ?? 0,
        };
      })
      .sort((a, b) => new Date(b.lastMessageAt!).getTime() - new Date(a.lastMessageAt!).getTime());
  },
};
