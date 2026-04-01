import { eq, desc } from "drizzle-orm";
import { db } from "../../db";
import { customers, jobs } from "@shared/schema";
import type { Customer, InsertCustomer, Job } from "@shared/schema";

export const customersRepository = {
  async getAll(): Promise<Customer[]> {
    return db.select().from(customers).orderBy(customers.name);
  },

  async getById(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  },

  async create(data: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(data).returning();
    return customer;
  },

  async update(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
    return customer;
  },

  async delete(id: number): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  },

  async getJobsByCustomer(customerId: number): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.customerId, customerId)).orderBy(desc(jobs.createdAt));
  },
};
