import { eq, ne } from "drizzle-orm";
import { db } from "../../db";
import { users } from "@shared/schema";
import type { User, InsertUser } from "@shared/schema";

export const usersRepository = {
  async getById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async getByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  },

  async getAll(): Promise<User[]> {
    return db.select().from(users).orderBy(users.name);
  },

  async create(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },

  async update(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  },

  async delete(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  },

  async getAdminAndDispatcherUserIds(): Promise<number[]> {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(ne(users.role, "technician"));
    return rows.map(r => r.id);
  },
};
