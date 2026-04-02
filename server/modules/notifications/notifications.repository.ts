import { eq, desc, and } from "drizzle-orm";
import { db } from "../../db";
import { notifications, type Notification } from "@shared/schema";

export const notificationsRepository = {
  async getUnread(userId: number): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.timestamp));
  },

  async markRead(id: number, userId?: number): Promise<boolean> {
    const where = userId
      ? and(eq(notifications.id, id), eq(notifications.userId, userId))
      : eq(notifications.id, id);
    const result = await db.update(notifications).set({ isRead: true }).where(where).returning({ id: notifications.id });
    return result.length > 0;
  },

  async markJobRead(userId: number, jobId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.jobId, jobId),
        eq(notifications.isRead, false),
      ));
  },

  /**
   * Upserts a message notification for a (userId, jobId) pair.
   * Increments messageCount on an existing unread row rather than inserting a
   * new one, keeping the badge count meaningful without flooding the table.
   */
  async upsertMessage(
    userId: number,
    jobId: number,
    data: { fromName: string; jobTitle: string; text: string; timestamp: Date },
  ): Promise<void> {
    const [existing] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId,  userId),
          eq(notifications.type,    "message"),
          eq(notifications.jobId,   jobId),
          eq(notifications.isRead,  false),
        ),
      );

    if (existing) {
      await db
        .update(notifications)
        .set({
          fromName:     data.fromName,
          text:         data.text,
          timestamp:    data.timestamp,
          messageCount: (existing.messageCount ?? 1) + 1,
        })
        .where(eq(notifications.id, existing.id));
    } else {
      await db.insert(notifications).values({
        userId,
        type:         "message",
        jobId,
        jobTitle:     data.jobTitle,
        fromName:     data.fromName,
        text:         data.text,
        timestamp:    data.timestamp,
        messageCount: 1,
        isRead:       false,
      });
    }
  },

  async createActivity(
    userId: number,
    data: {
      fromName:  string;
      jobId:     number | null;
      jobTitle:  string | null;
      text:      string;
      timestamp: Date;
      entryType: string;
    },
  ): Promise<void> {
    await db.insert(notifications).values({
      userId,
      type:      "activity",
      jobId:     data.jobId,
      jobTitle:  data.jobTitle,
      fromName:  data.fromName,
      text:      data.text,
      timestamp: data.timestamp,
      entryType: data.entryType,
      isRead:    false,
    });
  },
};
