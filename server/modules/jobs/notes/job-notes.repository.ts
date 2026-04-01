import { eq, desc } from "drizzle-orm";
import { db } from "../../../db";
import { jobNotes, jobNoteReads, users } from "@shared/schema";
import type { JobNote, InsertJobNote, User } from "@shared/schema";

export const jobNotesRepository = {
  async getJobNotes(jobId: number): Promise<(JobNote & { user?: User })[]> {
    const rows = await db
      .select()
      .from(jobNotes)
      .leftJoin(users, eq(jobNotes.userId, users.id))
      .where(eq(jobNotes.jobId, jobId))
      .orderBy(desc(jobNotes.createdAt));
    return rows.map((r) => ({ ...r.job_notes, user: r.users ?? undefined }));
  },

  async createJobNote(data: InsertJobNote): Promise<JobNote> {
    const [note] = await db.insert(jobNotes).values(data).returning();
    return note;
  },

  async markJobNoteRead(userId: number, jobId: number, lastNoteId: number): Promise<void> {
    await db.insert(jobNoteReads)
      .values({ userId, jobId, lastReadNoteId: lastNoteId })
      .onConflictDoUpdate({
        target: [jobNoteReads.userId, jobNoteReads.jobId],
        set: { lastReadNoteId: lastNoteId },
      });
  },
};
