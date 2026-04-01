import { eq } from "drizzle-orm";
import { db } from "../../db";
import { inventory } from "@shared/schema";
import type { InventoryItem, InsertInventoryItem } from "@shared/schema";

export const inventoryRepository = {
  async getAll(): Promise<InventoryItem[]> {
    return db.select().from(inventory).orderBy(inventory.name);
  },

  async getById(id: number): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventory).where(eq(inventory.id, id));
    return item;
  },

  async create(data: InsertInventoryItem): Promise<InventoryItem> {
    const [item] = await db.insert(inventory).values({ ...data, updatedAt: new Date() }).returning();
    return item;
  },

  async update(id: number, data: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const [item] = await db.update(inventory).set({ ...data, updatedAt: new Date() }).where(eq(inventory.id, id)).returning();
    return item;
  },

  async delete(id: number): Promise<void> {
    await db.delete(inventory).where(eq(inventory.id, id));
  },
};
