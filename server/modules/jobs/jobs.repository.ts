import { eq, desc } from "drizzle-orm";
import { db } from "../../db";
import { jobs, customers } from "@shared/schema";
import type { Job, InsertJob } from "@shared/schema";
import { numberingService } from "../../services/numbering.service";
import { customersRepository } from "../customers/customers.repository";

export const jobsRepository = {
  async getAll(): Promise<Job[]> {
    return db.select().from(jobs).orderBy(desc(jobs.createdAt));
  },

  async getById(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  },

  /** Returns the job created from a given request, or undefined if none exists. */
  async getByRequestId(requestId: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.requestId, requestId));
    return job ?? undefined;
  },

  async getByIdWithCustomerSummary(id: number): Promise<(Job & {
    customerSummary: { name: string; phone: string | null } | null;
  }) | undefined> {
    const [row] = await db
      .select({ job: jobs, customerName: customers.name, customerPhone: customers.phone })
      .from(jobs)
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .where(eq(jobs.id, id));
    if (!row) return undefined;
    return {
      ...row.job,
      customerSummary: row.customerName ? { name: row.customerName, phone: row.customerPhone ?? null } : null,
    };
  },

  async getByCustomer(customerId: number): Promise<Job[]> {
    return customersRepository.getJobsByCustomer(customerId);
  },

  async getByTechnician(technicianId: number): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.technicianId, technicianId)).orderBy(desc(jobs.scheduledAt));
  },

  async getByTechnicianWithCustomer(technicianId: number): Promise<(Job & { customerName?: string | null })[]> {
    const rows = await db
      .select({
        job: jobs,
        customerName: customers.name,
      })
      .from(jobs)
      .leftJoin(customers, eq(jobs.customerId, customers.id))
      .where(eq(jobs.technicianId, technicianId))
      .orderBy(desc(jobs.scheduledAt));
    return rows.map((r) => ({ ...r.job, customerName: r.customerName ?? null }));
  },

  async create(data: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values({ ...data, updatedAt: new Date() }).returning();
    return job;
  },

  async update(id: number, data: Partial<InsertJob>): Promise<Job | undefined> {
    const [job] = await db
      .update(jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return job;
  },

  async delete(id: number): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, id));
  },

  async getNextJobNumber(): Promise<string> {
    return numberingService.nextJobNumber();
  },
};
