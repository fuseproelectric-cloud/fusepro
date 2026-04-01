import { eq, desc } from "drizzle-orm";
import { db } from "../../db";
import { estimates } from "@shared/schema";
import type { Estimate, InsertEstimate } from "@shared/schema";

export const estimatesRepository = {
  async getAll(): Promise<Estimate[]> {
    return db.select().from(estimates).orderBy(desc(estimates.createdAt));
  },

  async getById(id: number): Promise<Estimate | undefined> {
    const [est] = await db.select().from(estimates).where(eq(estimates.id, id));
    return est;
  },

  async getByRequestId(requestId: number): Promise<Estimate | undefined> {
    const [est] = await db.select().from(estimates).where(eq(estimates.requestId, requestId));
    return est ?? undefined;
  },

  async create(data: InsertEstimate): Promise<Estimate> {
    const [est] = await db.insert(estimates).values(data).returning();
    return est;
  },

  async update(id: number, data: Partial<InsertEstimate>): Promise<Estimate | undefined> {
    const [est] = await db.update(estimates).set(data).where(eq(estimates.id, id)).returning();
    return est;
  },

  async delete(id: number): Promise<void> {
    await db.delete(estimates).where(eq(estimates.id, id));
  },
};
