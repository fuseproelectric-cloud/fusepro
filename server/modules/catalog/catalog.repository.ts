import { eq } from "drizzle-orm";
import { db } from "../../db";
import { services } from "@shared/schema";
import type { Service, InsertService } from "@shared/schema";

export const catalogRepository = {
  async getAll(): Promise<Service[]> {
    return db.select().from(services).orderBy(services.name);
  },

  async create(data: InsertService): Promise<Service> {
    const [svc] = await db.insert(services).values(data).returning();
    return svc;
  },

  async update(id: number, data: Partial<InsertService>): Promise<Service | undefined> {
    const [svc] = await db.update(services).set(data).where(eq(services.id, id)).returning();
    return svc;
  },

  async delete(id: number): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  },
};
