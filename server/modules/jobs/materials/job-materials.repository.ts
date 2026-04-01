import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { jobMaterials } from "@shared/schema";
import type { JobMaterial, InsertJobMaterial } from "@shared/schema";

export const jobMaterialsRepository = {
  async getJobMaterials(jobId: number): Promise<JobMaterial[]> {
    return db.select().from(jobMaterials).where(eq(jobMaterials.jobId, jobId)).orderBy(jobMaterials.createdAt);
  },

  async createJobMaterial(data: InsertJobMaterial): Promise<JobMaterial> {
    const [mat] = await db.insert(jobMaterials).values(data).returning();
    return mat;
  },

  async deleteJobMaterial(id: number): Promise<void> {
    await db.delete(jobMaterials).where(eq(jobMaterials.id, id));
  },
};
