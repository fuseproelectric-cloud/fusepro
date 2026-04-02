import { eq } from "drizzle-orm";
import { db } from "../../db";
import { adminSettings, type AdminSetting } from "@shared/schema";

export const settingsRepository = {
  async getAll(): Promise<AdminSetting[]> {
    return db.select().from(adminSettings);
  },

  async getByKey(key: string): Promise<AdminSetting | undefined> {
    const [setting] = await db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.key, key));
    return setting;
  },

  async upsert(key: string, value: string): Promise<AdminSetting> {
    const [setting] = await db
      .insert(adminSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: adminSettings.key, set: { value } })
      .returning();
    return setting;
  },
};
