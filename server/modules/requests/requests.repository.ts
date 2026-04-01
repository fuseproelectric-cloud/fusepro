import { eq, desc } from "drizzle-orm";
import { db } from "../../db";
import { requests } from "@shared/schema";
import type { Request, InsertRequest } from "@shared/schema";

export const requestsRepository = {
  async getAll(): Promise<Request[]> {
    return db.select().from(requests).orderBy(desc(requests.createdAt));
  },

  async getByCustomerId(customerId: number): Promise<Request[]> {
    return db.select().from(requests)
      .where(eq(requests.customerId, customerId))
      .orderBy(desc(requests.createdAt));
  },

  async getById(id: number): Promise<Request | undefined> {
    const [req] = await db.select().from(requests).where(eq(requests.id, id));
    return req;
  },

  async create(data: InsertRequest): Promise<Request> {
    const [req] = await db.insert(requests).values(data).returning();
    return req;
  },

  async update(id: number, data: Partial<InsertRequest>): Promise<Request | undefined> {
    const [req] = await db.update(requests).set(data).where(eq(requests.id, id)).returning();
    return req;
  },

  async delete(id: number): Promise<void> {
    await db.delete(requests).where(eq(requests.id, id));
  },
};
