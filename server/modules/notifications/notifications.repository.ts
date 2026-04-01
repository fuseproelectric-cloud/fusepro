import { eq, desc, and } from "drizzle-orm";
import { db } from "../../db";
import { notifications } from "@shared/schema";
import type { Notification } from "@shared/schema";

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
};
