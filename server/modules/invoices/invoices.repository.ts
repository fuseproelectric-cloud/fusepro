import { eq, desc } from "drizzle-orm";
import { db } from "../../db";
import { invoices } from "@shared/schema";
import type { Invoice, InsertInvoice } from "@shared/schema";
import { numberingService } from "../../services/numbering.service";

export const invoicesRepository = {
  async getAll(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  },

  async getById(id: number): Promise<Invoice | undefined> {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
    return inv;
  },

  /** Returns the invoice created from a given estimate, or undefined if none exists. */
  async getByEstimateId(estimateId: number): Promise<Invoice | undefined> {
    const [inv] = await db.select().from(invoices).where(eq(invoices.estimateId, estimateId));
    return inv ?? undefined;
  },

  async create(data: InsertInvoice): Promise<Invoice> {
    const [inv] = await db.insert(invoices).values(data).returning();
    return inv;
  },

  async update(id: number, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [inv] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return inv;
  },

  async delete(id: number): Promise<void> {
    await db.delete(invoices).where(eq(invoices.id, id));
  },

  async getNextInvoiceNumber(): Promise<string> {
    return numberingService.nextInvoiceNumber();
  },
};
