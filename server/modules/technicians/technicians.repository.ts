import { eq } from "drizzle-orm";
import { db } from "../../db";
import { technicians, users } from "@shared/schema";
import type { Technician, InsertTechnician, User } from "@shared/schema";

export const techniciansRepository = {
  async getAll(): Promise<(Technician & { user?: User })[]> {
    const rows = await db
      .select()
      .from(technicians)
      .leftJoin(users, eq(technicians.userId, users.id))
      .orderBy(users.name);
    return rows.map((r) => ({ ...r.technicians, user: r.users ?? undefined }));
  },

  async getById(id: number): Promise<(Technician & { user?: User }) | undefined> {
    const [row] = await db
      .select()
      .from(technicians)
      .leftJoin(users, eq(technicians.userId, users.id))
      .where(eq(technicians.id, id));
    if (!row) return undefined;
    return { ...row.technicians, user: row.users ?? undefined };
  },

  async getByUserId(userId: number): Promise<Technician | undefined> {
    const [tech] = await db.select().from(technicians).where(eq(technicians.userId, userId));
    return tech;
  },

  async create(data: InsertTechnician): Promise<Technician> {
    const [tech] = await db.insert(technicians).values(data).returning();
    return tech;
  },

  async update(id: number, data: Partial<InsertTechnician>): Promise<Technician | undefined> {
    const [tech] = await db.update(technicians).set(data).where(eq(technicians.id, id)).returning();
    return tech;
  },

  async delete(id: number): Promise<void> {
    await db.delete(technicians).where(eq(technicians.id, id));
  },
};
