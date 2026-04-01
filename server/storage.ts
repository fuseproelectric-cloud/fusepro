import { eq, desc, and, gte, lt, sql, inArray, ne, asc } from "drizzle-orm";
import { db } from "./db";
import { dayBoundsCT, weekBoundsCT, dateStrCT } from "./lib/time";
import { numberingService } from "./services/numbering.service";
import { customerAddressService } from "./services/customer-address.service";
import { inventoryRepository } from "./modules/inventory/inventory.repository";
import { catalogRepository } from "./modules/catalog/catalog.repository";
import { notificationsRepository } from "./modules/notifications/notifications.repository";
import { dashboardRepository } from "./modules/dashboard/dashboard.repository";
import {
  users, customers, technicians, jobs, estimates, invoices,
  inventory, jobNotes, adminSettings, timesheets, jobMaterials, notifications, jobNoteReads,
  conversations, conversationMembers, convMessages, timesheetApprovals,
  requests,
  type User, type InsertUser,
  type Customer, type InsertCustomer,
  type CustomerAddress, type InsertCustomerAddress,
  type Technician, type InsertTechnician,
  type Job, type InsertJob,
  type Estimate, type InsertEstimate,
  type Invoice, type InsertInvoice,
  type InventoryItem, type InsertInventoryItem,
  type JobNote, type InsertJobNote,
  type AdminSetting, type InsertAdminSetting,
  type Timesheet, type InsertTimesheet,
  type JobMaterial, type InsertJobMaterial,
  type Notification,
  type Conversation,
  type ConvMessage,
  type Request, type InsertRequest,
  type Service, type InsertService,
} from "@shared/schema";
import type { DashboardStats } from "@shared/routes";

export class Storage {
  // ─── Users ──────────────────────────────────────────────────────────────────
  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.name);
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ─── Customers ──────────────────────────────────────────────────────────────
  async getAllCustomers(): Promise<Customer[]> {
    return db.select().from(customers).orderBy(customers.name);
  }

  async getCustomerById(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(data: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(data).returning();
    return customer;
  }

  async updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
    return customer;
  }

  async deleteCustomer(id: number): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  // ─── Customer Addresses ──────────────────────────────────────────────────────
  async getAddressesByCustomer(customerId: number): Promise<CustomerAddress[]> {
    return customerAddressService.getByCustomer(customerId);
  }

  async createCustomerAddress(data: InsertCustomerAddress): Promise<CustomerAddress> {
    return customerAddressService.create(data);
  }

  async updateCustomerAddress(id: number, data: Partial<InsertCustomerAddress>): Promise<CustomerAddress | undefined> {
    return customerAddressService.update(id, data);
  }

  async deleteCustomerAddress(id: number): Promise<void> {
    return customerAddressService.delete(id);
  }

  // ─── Technicians ────────────────────────────────────────────────────────────
  async getAllTechnicians(): Promise<(Technician & { user?: User })[]> {
    const rows = await db
      .select()
      .from(technicians)
      .leftJoin(users, eq(technicians.userId, users.id))
      .orderBy(users.name);
    return rows.map((r) => ({ ...r.technicians, user: r.users ?? undefined }));
  }

  async getTechnicianById(id: number): Promise<(Technician & { user?: User }) | undefined> {
    const [row] = await db
      .select()
      .from(technicians)
      .leftJoin(users, eq(technicians.userId, users.id))
      .where(eq(technicians.id, id));
    if (!row) return undefined;
    return { ...row.technicians, user: row.users ?? undefined };
  }

  async getTechnicianByUserId(userId: number): Promise<Technician | undefined> {
    const [tech] = await db.select().from(technicians).where(eq(technicians.userId, userId));
    return tech;
  }

  async createTechnician(data: InsertTechnician): Promise<Technician> {
    const [tech] = await db.insert(technicians).values(data).returning();
    return tech;
  }

  async updateTechnician(id: number, data: Partial<InsertTechnician>): Promise<Technician | undefined> {
    const [tech] = await db.update(technicians).set(data).where(eq(technicians.id, id)).returning();
    return tech;
  }

  async deleteTechnician(id: number): Promise<void> {
    await db.delete(technicians).where(eq(technicians.id, id));
  }

  // ─── Jobs ───────────────────────────────────────────────────────────────────
  async getAllJobs(): Promise<Job[]> {
    return db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }

  async getJobById(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  /** Returns the job created from a given request, or undefined if none exists. */
  async getJobByRequestId(requestId: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.requestId, requestId));
    return job ?? undefined;
  }

  async getJobByIdWithCustomerSummary(id: number): Promise<(Job & {
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
  }

  async getJobsByCustomer(customerId: number): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.customerId, customerId)).orderBy(desc(jobs.createdAt));
  }

  async getJobsByTechnician(technicianId: number): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.technicianId, technicianId)).orderBy(desc(jobs.scheduledAt));
  }

  async createJob(data: InsertJob): Promise<Job> {
    const [job] = await db.insert(jobs).values({ ...data, updatedAt: new Date() }).returning();
    return job;
  }

  async updateJob(id: number, data: Partial<InsertJob>): Promise<Job | undefined> {
    const [job] = await db
      .update(jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();
    return job;
  }

  async deleteJob(id: number): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  // ─── Estimates ──────────────────────────────────────────────────────────────
  async getAllEstimates(): Promise<Estimate[]> {
    return db.select().from(estimates).orderBy(desc(estimates.createdAt));
  }

  async getEstimateById(id: number): Promise<Estimate | undefined> {
    const [est] = await db.select().from(estimates).where(eq(estimates.id, id));
    return est;
  }

  /** Returns the estimate created from a given request, or undefined if none exists. */
  async getEstimateByRequestId(requestId: number): Promise<Estimate | undefined> {
    const [est] = await db.select().from(estimates).where(eq(estimates.requestId, requestId));
    return est ?? undefined;
  }

  async createEstimate(data: InsertEstimate): Promise<Estimate> {
    const [est] = await db.insert(estimates).values(data).returning();
    return est;
  }

  async updateEstimate(id: number, data: Partial<InsertEstimate>): Promise<Estimate | undefined> {
    const [est] = await db.update(estimates).set(data).where(eq(estimates.id, id)).returning();
    return est;
  }

  async deleteEstimate(id: number): Promise<void> {
    await db.delete(estimates).where(eq(estimates.id, id));
  }

  // ─── Invoices ───────────────────────────────────────────────────────────────
  async getAllInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoiceById(id: number): Promise<Invoice | undefined> {
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id));
    return inv;
  }

  /** Returns the invoice created from a given estimate, or undefined if none exists. */
  async getInvoiceByEstimateId(estimateId: number): Promise<Invoice | undefined> {
    const [inv] = await db.select().from(invoices).where(eq(invoices.estimateId, estimateId));
    return inv ?? undefined;
  }

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const [inv] = await db.insert(invoices).values(data).returning();
    return inv;
  }

  async updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [inv] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return inv;
  }

  async deleteInvoice(id: number): Promise<void> {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  async getNextInvoiceNumber(): Promise<string> {
    return numberingService.nextInvoiceNumber();
  }

  // ─── Inventory ──────────────────────────────────────────────────────────────
  async getAllInventory(): Promise<InventoryItem[]> {
    return inventoryRepository.getAll();
  }

  async getInventoryById(id: number): Promise<InventoryItem | undefined> {
    return inventoryRepository.getById(id);
  }

  async createInventoryItem(data: InsertInventoryItem): Promise<InventoryItem> {
    return inventoryRepository.create(data);
  }

  async updateInventoryItem(id: number, data: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    return inventoryRepository.update(id, data);
  }

  async deleteInventoryItem(id: number): Promise<void> {
    return inventoryRepository.delete(id);
  }

  // ─── Job Notes ──────────────────────────────────────────────────────────────
  async getJobNotes(jobId: number): Promise<(JobNote & { user?: User })[]> {
    const rows = await db
      .select()
      .from(jobNotes)
      .leftJoin(users, eq(jobNotes.userId, users.id))
      .where(eq(jobNotes.jobId, jobId))
      .orderBy(desc(jobNotes.createdAt));
    return rows.map((r) => ({ ...r.job_notes, user: r.users ?? undefined }));
  }

  async createJobNote(data: InsertJobNote): Promise<JobNote> {
    const [note] = await db.insert(jobNotes).values(data).returning();
    return note;
  }

  // ─── Admin Settings ─────────────────────────────────────────────────────────
  async getAllSettings(): Promise<AdminSetting[]> {
    return db.select().from(adminSettings);
  }

  async getSetting(key: string): Promise<AdminSetting | undefined> {
    const [setting] = await db.select().from(adminSettings).where(eq(adminSettings.key, key));
    return setting;
  }

  async upsertSetting(key: string, value: string): Promise<AdminSetting> {
    const [setting] = await db
      .insert(adminSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: adminSettings.key, set: { value } })
      .returning();
    return setting;
  }

  // ─── Timesheets ─────────────────────────────────────────────────────────────
  async getTodayTimesheets(technicianId: number): Promise<(Timesheet & { jobTitle?: string | null })[]> {
    const { start: startOfDay, end: endOfDay } = dayBoundsCT();
    const rows = await db
      .select({
        ts: timesheets,
        jobTitle: jobs.title,
      })
      .from(timesheets)
      .leftJoin(jobs, eq(timesheets.jobId, jobs.id))
      .where(
        and(
          eq(timesheets.technicianId, technicianId),
          gte(timesheets.timestamp, startOfDay),
          lt(timesheets.timestamp, endOfDay)
        )
      )
      .orderBy(timesheets.timestamp);
    return rows.map((r) => ({ ...r.ts, jobTitle: r.jobTitle ?? null }));
  }

  async getWeekTimesheets(technicianId: number, weekOf?: string): Promise<(Timesheet & { jobTitle?: string | null })[]> {
    const { start: startOfWeek, end: endOfWeek } = weekBoundsCT(weekOf);
    const rows = await db
      .select({
        ts: timesheets,
        jobTitle: jobs.title,
      })
      .from(timesheets)
      .leftJoin(jobs, eq(timesheets.jobId, jobs.id))
      .where(
        and(
          eq(timesheets.technicianId, technicianId),
          gte(timesheets.timestamp, startOfWeek),
          lt(timesheets.timestamp, endOfWeek)
        )
      )
      .orderBy(timesheets.timestamp);
    return rows.map((r) => ({ ...r.ts, jobTitle: r.jobTitle ?? null }));
  }

  async approveTimesheetDay(technicianId: number, date: string, approvedBy: number): Promise<void> {
    // Read the technician's current hourlyRate and freeze it on the approval record.
    // This prevents future rate changes from retroactively altering approved earnings.
    const [tech] = await db.select({ hourlyRate: technicians.hourlyRate })
      .from(technicians).where(eq(technicians.id, technicianId));
    const snapshotRate = tech?.hourlyRate ?? "25.00";

    await db.insert(timesheetApprovals)
      .values({ technicianId, date, approvedBy, snapshotRate })
      .onConflictDoUpdate({
        target: [timesheetApprovals.technicianId, timesheetApprovals.date],
        // Re-approving refreshes both the approver identity and the rate snapshot.
        set: { approvedBy, approvedAt: new Date(), snapshotRate },
      });
  }

  async unapproveTimesheetDay(technicianId: number, date: string): Promise<void> {
    await db.delete(timesheetApprovals)
      .where(and(eq(timesheetApprovals.technicianId, technicianId), eq(timesheetApprovals.date, date)));
  }

  async getTimesheetApprovals(technicianId: number, dates: string[]): Promise<Record<string, { approvedBy: number; approvedAt: Date; snapshotRate: string | null }>> {
    if (dates.length === 0) return {};
    const rows = await db.select().from(timesheetApprovals)
      .where(and(eq(timesheetApprovals.technicianId, technicianId), inArray(timesheetApprovals.date, dates)));
    const result: Record<string, { approvedBy: number; approvedAt: Date; snapshotRate: string | null }> = {};
    for (const r of rows) result[r.date] = { approvedBy: r.approvedBy, approvedAt: r.approvedAt, snapshotRate: r.snapshotRate ?? null };
    return result;
  }

  async createTimesheetEntry(data: InsertTimesheet): Promise<Timesheet> {
    const [entry] = await db.insert(timesheets).values(data).returning();
    return entry;
  }

  async getTimesheetEntryById(id: number): Promise<Timesheet | null> {
    const [entry] = await db.select().from(timesheets).where(eq(timesheets.id, id));
    return entry ?? null;
  }

  async updateTimesheetEntry(id: number, data: { entryType?: string; timestamp?: Date; notes?: string | null }): Promise<Timesheet | null> {
    const [entry] = await db.update(timesheets).set(data).where(eq(timesheets.id, id)).returning();
    return entry ?? null;
  }

  async deleteTimesheetEntry(id: number): Promise<void> {
    await db.delete(timesheets).where(eq(timesheets.id, id));
  }

  async getTimesheetEntriesByJob(jobId: number): Promise<(Timesheet & { technicianName?: string | null })[]> {
    const rows = await db
      .select({ ts: timesheets, techName: users.name })
      .from(timesheets)
      .leftJoin(technicians, eq(timesheets.technicianId, technicians.id))
      .leftJoin(users, eq(technicians.userId, users.id))
      .where(eq(timesheets.jobId, jobId))
      .orderBy(timesheets.timestamp);
    return rows.map((r) => ({ ...r.ts, technicianName: r.techName ?? null }));
  }

  async getLastTimesheetEntry(technicianId: number, entryType?: string): Promise<Timesheet | null> {
    const conditions = entryType
      ? and(eq(timesheets.technicianId, technicianId), eq(timesheets.entryType, entryType))
      : eq(timesheets.technicianId, technicianId);
    const [entry] = await db
      .select()
      .from(timesheets)
      .where(conditions)
      .orderBy(desc(timesheets.timestamp))
      .limit(1);
    return entry ?? null;
  }

  async getTechnicianCurrentStatus(technicianId: number): Promise<{
    isDayStarted: boolean;
    isOnBreak: boolean;
    activeJobId: number | null;
    dayStartTime: Date | null;
    totalWorkMinutesToday: number;
    totalTravelMinutesToday: number;
  }> {
    const todayEntries = await this.getTodayTimesheets(technicianId);

    // Find last day_start and day_end
    const dayStarts = todayEntries.filter((e) => e.entryType === "day_start");
    const dayEnds = todayEntries.filter((e) => e.entryType === "day_end");
    const isDayStarted = dayStarts.length > dayEnds.length;
    const dayStartEntry = dayStarts.length > 0 ? dayStarts[dayStarts.length - 1] : null;

    // Break status
    const breakStarts = todayEntries.filter((e) => e.entryType === "break_start");
    const breakEnds = todayEntries.filter((e) => e.entryType === "break_end");
    const isOnBreak = breakStarts.length > breakEnds.length;

    // Active job: last work_start without a corresponding work_end
    const workStarts = todayEntries.filter((e) => e.entryType === "work_start");
    const workEnds = todayEntries.filter((e) => e.entryType === "work_end");
    const lastWorkStart = workStarts.length > 0 ? workStarts[workStarts.length - 1] : null;
    const lastWorkEnd = workEnds.length > 0 ? workEnds[workEnds.length - 1] : null;
    const isCurrentlyWorking =
      lastWorkStart !== null &&
      (lastWorkEnd === null ||
        new Date(lastWorkStart.timestamp).getTime() > new Date(lastWorkEnd.timestamp).getTime());
    const activeJobId = isCurrentlyWorking && lastWorkStart ? (lastWorkStart.jobId ?? null) : null;

    // Calculate total work minutes
    let totalWorkMinutes = 0;
    const now = new Date();
    const sortedEntries = [...todayEntries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    let openWorkStart: Date | null = null;
    for (const entry of sortedEntries) {
      if (entry.entryType === "work_start") {
        openWorkStart = new Date(entry.timestamp);
      } else if (entry.entryType === "work_end" && openWorkStart) {
        totalWorkMinutes += Math.floor(
          (new Date(entry.timestamp).getTime() - openWorkStart.getTime()) / 60000
        );
        openWorkStart = null;
      }
    }
    if (openWorkStart) {
      totalWorkMinutes += Math.floor((now.getTime() - openWorkStart.getTime()) / 60000);
    }

    // Calculate total travel minutes
    let totalTravelMinutes = 0;
    let openTravelStart: Date | null = null;
    for (const entry of sortedEntries) {
      if (entry.entryType === "travel_start") {
        openTravelStart = new Date(entry.timestamp);
      } else if (entry.entryType === "travel_end" && openTravelStart) {
        totalTravelMinutes += Math.floor(
          (new Date(entry.timestamp).getTime() - openTravelStart.getTime()) / 60000
        );
        openTravelStart = null;
      }
    }
    if (openTravelStart) {
      totalTravelMinutes += Math.floor((now.getTime() - openTravelStart.getTime()) / 60000);
    }

    return {
      isDayStarted,
      isOnBreak,
      activeJobId,
      dayStartTime: dayStartEntry ? new Date(dayStartEntry.timestamp) : null,
      totalWorkMinutesToday: totalWorkMinutes,
      totalTravelMinutesToday: totalTravelMinutes,
    };
  }

  // ─── Admin Timesheet (all technicians) ──────────────────────────────────────
  async getAllTimesheetsByDate(dateStrOrDate: Date | string): Promise<{
    technicianId: number;
    technicianName: string;
    technicianColor: string;
    entries: (Timesheet & { jobTitle?: string | null })[];
  }[]> {
    const ctStr = typeof dateStrOrDate === "string" ? dateStrOrDate : dateStrCT(dateStrOrDate);
    const { start: startOfDay, end: endOfDay } = dayBoundsCT(ctStr);

    const rows = await db
      .select({
        ts: timesheets,
        jobTitle: jobs.title,
        userName: users.name,
        techColor: technicians.color,
      })
      .from(timesheets)
      .leftJoin(jobs, eq(timesheets.jobId, jobs.id))
      .leftJoin(technicians, eq(timesheets.technicianId, technicians.id))
      .leftJoin(users, eq(technicians.userId, users.id))
      .where(and(gte(timesheets.timestamp, startOfDay), lt(timesheets.timestamp, endOfDay)))
      .orderBy(timesheets.technicianId, timesheets.timestamp);

    // Group by technician
    const map = new Map<number, { technicianId: number; technicianName: string; technicianColor: string; entries: (Timesheet & { jobTitle?: string | null })[] }>();
    for (const row of rows) {
      const tid = row.ts.technicianId;
      if (!map.has(tid)) {
        map.set(tid, {
          technicianId: tid,
          technicianName: row.userName ?? `Tech #${tid}`,
          technicianColor: row.techColor ?? "#f97316",
          entries: [],
        });
      }
      map.get(tid)!.entries.push({ ...row.ts, jobTitle: row.jobTitle ?? null });
    }

    // Also include technicians with no entries (so admin can see all)
    const allTechs = await this.getAllTechnicians();
    for (const tech of allTechs) {
      if (!map.has(tech.id)) {
        map.set(tech.id, {
          technicianId: tech.id,
          technicianName: tech.user?.name ?? `Tech #${tech.id}`,
          technicianColor: tech.color ?? "#f97316",
          entries: [],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.technicianName.localeCompare(b.technicianName));
  }

  async getAllTimesheetsByRange(fromStr: string, toStr: string): Promise<{
    technicianId: number;
    technicianName: string;
    technicianColor: string;
    entries: (Timesheet & { jobTitle?: string | null })[];
  }[]> {
    const { start } = dayBoundsCT(fromStr);
    const { end } = dayBoundsCT(toStr);

    const rows = await db
      .select({ ts: timesheets, jobTitle: jobs.title, userName: users.name, techColor: technicians.color })
      .from(timesheets)
      .leftJoin(jobs, eq(timesheets.jobId, jobs.id))
      .leftJoin(technicians, eq(timesheets.technicianId, technicians.id))
      .leftJoin(users, eq(technicians.userId, users.id))
      .where(and(gte(timesheets.timestamp, start), lt(timesheets.timestamp, end)))
      .orderBy(timesheets.technicianId, timesheets.timestamp);

    const map = new Map<number, { technicianId: number; technicianName: string; technicianColor: string; entries: (Timesheet & { jobTitle?: string | null })[] }>();
    for (const row of rows) {
      const tid = row.ts.technicianId;
      if (!map.has(tid)) map.set(tid, { technicianId: tid, technicianName: row.userName ?? `Tech #${tid}`, technicianColor: row.techColor ?? "#f97316", entries: [] });
      map.get(tid)!.entries.push({ ...row.ts, jobTitle: row.jobTitle ?? null });
    }
    const allTechs = await this.getAllTechnicians();
    for (const tech of allTechs) {
      if (!map.has(tech.id)) map.set(tech.id, { technicianId: tech.id, technicianName: tech.user?.name ?? `Tech #${tech.id}`, technicianColor: tech.color ?? "#f97316", entries: [] });
    }
    return Array.from(map.values()).sort((a, b) => a.technicianName.localeCompare(b.technicianName));
  }

  // ─── Job Materials ───────────────────────────────────────────────────────────
  async getJobMaterials(jobId: number): Promise<JobMaterial[]> {
    return db.select().from(jobMaterials).where(eq(jobMaterials.jobId, jobId)).orderBy(jobMaterials.createdAt);
  }

  async createJobMaterial(data: InsertJobMaterial): Promise<JobMaterial> {
    const [mat] = await db.insert(jobMaterials).values(data).returning();
    return mat;
  }

  async deleteJobMaterial(id: number): Promise<void> {
    await db.delete(jobMaterials).where(eq(jobMaterials.id, id));
  }

  // ─── Technician-specific job queries ────────────────────────────────────────
  async getJobsByTechnicianWithCustomer(technicianId: number): Promise<(Job & { customerName?: string | null })[]> {
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
  }

  async getTechnicianMyStats(technicianId: number): Promise<{
    myJobsToday: number;
    myInProgress: number;
    myCompleted: number;
    myCompletedThisMonth: number;
    upcomingJobs: (Job & { customerName?: string | null })[];
  }> {
    return dashboardRepository.getMyStats(technicianId);
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  async getDashboardStats(): Promise<DashboardStats> {
    return dashboardRepository.getStats();
  }

  // ─── Notifications ──────────────────────────────────────────────────────────
  async getUnreadNotifications(userId: number): Promise<Notification[]> {
    return notificationsRepository.getUnread(userId);
  }

  // Upsert for chat messages: one unread row per (userId, jobId), increment count
  async upsertMessageNotification(userId: number, jobId: number, data: {
    fromName: string;
    jobTitle: string;
    text: string;
    timestamp: Date;
  }): Promise<void> {
    const [existing] = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.type, "message"),
        eq(notifications.jobId, jobId),
        eq(notifications.isRead, false),
      ));

    if (existing) {
      await db
        .update(notifications)
        .set({
          fromName: data.fromName,
          text: data.text,
          timestamp: data.timestamp,
          messageCount: (existing.messageCount ?? 1) + 1,
        })
        .where(eq(notifications.id, existing.id));
    } else {
      await db.insert(notifications).values({
        userId,
        type: "message",
        jobId,
        jobTitle: data.jobTitle,
        fromName: data.fromName,
        text: data.text,
        timestamp: data.timestamp,
        messageCount: 1,
        isRead: false,
      });
    }
  }

  async createActivityNotification(userId: number, data: {
    fromName: string;
    jobId: number | null;
    jobTitle: string | null;
    text: string;
    timestamp: Date;
    entryType: string;
  }): Promise<void> {
    await db.insert(notifications).values({
      userId,
      type: "activity",
      jobId: data.jobId,
      jobTitle: data.jobTitle,
      fromName: data.fromName,
      text: data.text,
      timestamp: data.timestamp,
      entryType: data.entryType,
      isRead: false,
    });
  }

  async markNotificationRead(id: number, userId?: number): Promise<boolean> {
    return notificationsRepository.markRead(id, userId);
  }

  async markJobNotificationsRead(userId: number, jobId: number): Promise<void> {
    return notificationsRepository.markJobRead(userId, jobId);
  }

  async getAdminAndDispatcherUserIds(): Promise<number[]> {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(ne(users.role, "technician"));
    return rows.map(r => r.id);
  }

  // ─── Conversations ──────────────────────────────────────────────────────────
  async getConversationsForUser(userId: number): Promise<Array<{
    id: number; type: string; name: string | null; jobId: number | null;
    lastMessage: string | null; lastMessageAt: string | null;
    unreadCount: number; memberCount: number;
    members: Array<{ id: number; name: string; role: string }>;
  }>> {
    // Get conversations where user is a member
    const memberRows = await db
      .select({ convId: conversationMembers.conversationId, lastReadId: conversationMembers.lastReadId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));

    if (memberRows.length === 0) return [];

    const convIds = memberRows.map(r => r.convId);
    const readMap: Record<number, number> = {};
    memberRows.forEach(r => { readMap[r.convId] = r.lastReadId; });

    const convRows = await db
      .select()
      .from(conversations)
      .where(inArray(conversations.id, convIds));

    // Batch: fetch all messages for these conversations once, sorted desc.
    // Used for both last-message-per-conversation and unread counts.
    // Drizzle ORM inArray handles integer typing correctly — no raw SQL needed.
    const allMsgs = await db
      .select({
        id: convMessages.id,
        conversationId: convMessages.conversationId,
        userId: convMessages.userId,
        content: convMessages.content,
        createdAt: convMessages.createdAt,
      })
      .from(convMessages)
      .where(inArray(convMessages.conversationId, convIds))
      .orderBy(desc(convMessages.id));

    // Derive last message map and unread counts in a single JS pass
    const lastMsgMap: Record<number, { content: string; createdAt: Date }> = {};
    const unreadMap: Record<number, number> = {};
    for (const r of allMsgs) {
      if (!(r.conversationId in lastMsgMap)) {
        lastMsgMap[r.conversationId] = { content: r.content, createdAt: r.createdAt };
      }
      if (r.id > (readMap[r.conversationId] ?? 0) && r.userId !== userId) {
        unreadMap[r.conversationId] = (unreadMap[r.conversationId] ?? 0) + 1;
      }
    }

    // Batch: all members for all conversations (1 query)
    const allMemberRows = await db
      .select({ convId: conversationMembers.conversationId, id: users.id, name: users.name, role: users.role })
      .from(conversationMembers)
      .innerJoin(users, eq(conversationMembers.userId, users.id))
      .where(inArray(conversationMembers.conversationId, convIds));
    const membersMap: Record<number, Array<{ id: number; name: string; role: string }>> = {};
    for (const r of allMemberRows) {
      if (!membersMap[r.convId]) membersMap[r.convId] = [];
      membersMap[r.convId].push({ id: r.id, name: r.name, role: r.role });
    }

    const result = convRows.map(conv => {
      const lastMsg = lastMsgMap[conv.id];
      const memberList = membersMap[conv.id] ?? [];
      return {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        jobId: conv.jobId,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.createdAt ? new Date(lastMsg.createdAt).toISOString() : null,
        unreadCount: unreadMap[conv.id] ?? 0,
        memberCount: memberList.length,
        members: memberList,
      };
    });

    return result.sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (a.type === "team") return -1; // team conversation always first
      if (b.type === "team") return 1;
      return tb - ta;
    });
  }

  async getConversationById(id: number): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conv;
  }

  async updateConversationName(id: number, name: string): Promise<void> {
    await db.update(conversations).set({ name }).where(eq(conversations.id, id));
  }

  async createConversation(data: {
    type: string; name?: string; jobId?: number; createdBy: number; memberIds: number[];
  }): Promise<Conversation> {
    const [conv] = await db.insert(conversations).values({
      type: data.type,
      name: data.name ?? null,
      jobId: data.jobId ?? null,
      createdBy: data.createdBy,
    }).returning();

    // Add members
    const uniqueIds = Array.from(new Set([data.createdBy, ...data.memberIds]));
    await db.insert(conversationMembers).values(
      uniqueIds.map(uid => ({ conversationId: conv.id, userId: uid }))
    ).onConflictDoNothing();

    return conv;
  }

  async getOrCreateDirectConversation(userId1: number, userId2: number): Promise<Conversation> {
    // Find existing direct conversation between exactly these two users
    const existing = await db.execute(sql`
      SELECT c.id FROM conversations c
      WHERE c.type = 'direct'
        AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ${userId1})
        AND EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = c.id AND user_id = ${userId2})
        AND (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) = 2
      LIMIT 1
    `);
    if (existing.rows.length > 0) {
      const [conv] = await db.select().from(conversations).where(eq(conversations.id, Number((existing.rows[0] as any).id)));
      return conv;
    }
    return this.createConversation({ type: "direct", createdBy: userId1, memberIds: [userId2] });
  }

  async getConvMessages(conversationId: number, limit = 60, before?: number): Promise<(ConvMessage & { userName: string; userRole: string })[]> {
    const rows = await db
      .select({ msg: convMessages, name: users.name, role: users.role })
      .from(convMessages)
      .innerJoin(users, eq(convMessages.userId, users.id))
      .where(and(
        eq(convMessages.conversationId, conversationId),
        before ? lt(convMessages.id, before) : undefined,
      ))
      .orderBy(desc(convMessages.id))
      .limit(limit);
    return rows.reverse().map(r => ({ ...r.msg, userName: r.name, userRole: r.role }));
  }

  async createConvMessage(conversationId: number, userId: number, content: string): Promise<ConvMessage & { userName: string; userRole: string }> {
    const [msg] = await db.insert(convMessages).values({ conversationId, userId, content }).returning();
    const user = await this.getUserById(userId);
    return { ...msg, userName: user?.name ?? "Unknown", userRole: user?.role ?? "technician" };
  }

  async markConvRead(conversationId: number, userId: number, lastId: number): Promise<void> {
    await db
      .update(conversationMembers)
      .set({ lastReadId: lastId })
      .where(and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
      ));
  }

  async getConvMembers(conversationId: number): Promise<Array<{ id: number; name: string; role: string }>> {
    return db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(conversationMembers)
      .innerJoin(users, eq(conversationMembers.userId, users.id))
      .where(eq(conversationMembers.conversationId, conversationId));
  }

  async addConvMember(conversationId: number, userId: number): Promise<void> {
    await db.insert(conversationMembers).values({ conversationId, userId }).onConflictDoNothing();
  }

  async removeConvMember(conversationId: number, userId: number): Promise<void> {
    await db.delete(conversationMembers).where(and(
      eq(conversationMembers.conversationId, conversationId),
      eq(conversationMembers.userId, userId),
    ));
  }

  async markJobNoteRead(userId: number, jobId: number, lastNoteId: number): Promise<void> {
    await db.insert(jobNoteReads)
      .values({ userId, jobId, lastReadNoteId: lastNoteId })
      .onConflictDoUpdate({
        target: [jobNoteReads.userId, jobNoteReads.jobId],
        set: { lastReadNoteId: lastNoteId },
      });
  }

  async getTechnicianEarnings(technicianId: number, fromStr: string, toStr: string): Promise<{
    hourlyRate: number;
    totalWorkMinutes: number;
    totalTravelMinutes: number;
    totalEarnings: number;
    jobs: Array<{ jobId: number | null; jobTitle: string; workMinutes: number; travelMinutes: number; earnings: number; date: string }>;
    daily: Array<{ date: string; workMinutes: number; travelMinutes: number; earnings: number }>;
  }> {
    const { start } = dayBoundsCT(fromStr);
    const { end } = dayBoundsCT(toStr);

    const [tech] = await db.select({ hourlyRate: technicians.hourlyRate })
      .from(technicians).where(eq(technicians.id, technicianId));
    const currentRate = Number(tech?.hourlyRate ?? 25);

    const rows = await db
      .select({ ts: timesheets, jobTitle: jobs.title })
      .from(timesheets)
      .leftJoin(jobs, eq(timesheets.jobId, jobs.id))
      .where(and(eq(timesheets.technicianId, technicianId), gte(timesheets.timestamp, start), lt(timesheets.timestamp, end)))
      .orderBy(timesheets.timestamp);

    // Fetch approvals for every date that appears in the result set, so we can use
    // the snapshotRate (frozen at approval time) instead of the current hourlyRate.
    const allDates = [...new Set(rows.map(r => r.ts.timestamp.toISOString().slice(0, 10)))];
    const approvalsMap = allDates.length > 0
      ? await this.getTimesheetApprovals(technicianId, allDates)
      : {} as Record<string, { approvedBy: number; approvedAt: Date; snapshotRate: string | null }>;

    // Returns the effective rate for a calendar date.
    // Approved days use the frozen snapshotRate; unapproved days use the current rate.
    const rateFor = (date: string): number => {
      const appr = approvalsMap[date];
      if (appr?.snapshotRate != null) return Number(appr.snapshotRate);
      return currentRate;
    };

    // Group by jobId
    const jobMap = new Map<string, { jobId: number | null; jobTitle: string; entries: typeof rows[0][]; date: string }>();
    for (const row of rows) {
      const key = row.ts.jobId != null ? `job-${row.ts.jobId}` : `day-${row.ts.timestamp.toISOString().slice(0, 10)}`;
      if (!jobMap.has(key)) {
        jobMap.set(key, {
          jobId: row.ts.jobId,
          jobTitle: row.jobTitle ?? (row.ts.jobId ? `Job #${row.ts.jobId}` : 'General'),
          entries: [],
          date: row.ts.timestamp.toISOString().slice(0, 10),
        });
      }
      jobMap.get(key)!.entries.push(row);
    }

    const calcMins = (entries: typeof rows) => {
      let workMins = 0, travelMins = 0;
      let openWork: Date | null = null, openTravel: Date | null = null;
      for (const { ts } of entries) {
        if (ts.entryType === 'work_start') openWork = new Date(ts.timestamp);
        else if (ts.entryType === 'work_end' && openWork) { workMins += Math.floor((new Date(ts.timestamp).getTime() - openWork.getTime()) / 60000); openWork = null; }
        if (ts.entryType === 'travel_start') openTravel = new Date(ts.timestamp);
        else if (ts.entryType === 'travel_end' && openTravel) { travelMins += Math.floor((new Date(ts.timestamp).getTime() - openTravel.getTime()) / 60000); openTravel = null; }
      }
      return { workMins, travelMins };
    };

    const jobResults = [...jobMap.values()]
      .filter(g => g.jobId != null)
      .map(g => {
        const { workMins, travelMins } = calcMins(g.entries);
        return { jobId: g.jobId, jobTitle: g.jobTitle, workMinutes: workMins, travelMinutes: travelMins, earnings: Math.round((workMins / 60) * rateFor(g.date) * 100) / 100, date: g.date };
      })
      .filter(j => j.workMinutes > 0)
      .sort((a, b) => b.date.localeCompare(a.date));

    // Daily breakdown — each day uses its own effective rate
    const dailyMap = new Map<string, { workMins: number; travelMins: number }>();
    for (const row of rows) {
      const d = row.ts.timestamp.toISOString().slice(0, 10);
      if (!dailyMap.has(d)) dailyMap.set(d, { workMins: 0, travelMins: 0 });
    }
    for (const [date] of dailyMap) {
      const dayEntries = rows.filter(r => r.ts.timestamp.toISOString().slice(0, 10) === date);
      const { workMins, travelMins } = calcMins(dayEntries);
      dailyMap.set(date, { workMins, travelMins });
    }
    const daily = [...dailyMap.entries()]
      .map(([date, { workMins, travelMins }]) => ({ date, workMinutes: workMins, travelMinutes: travelMins, earnings: Math.round((workMins / 60) * rateFor(date) * 100) / 100 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalWorkMinutes = daily.reduce((s, d) => s + d.workMinutes, 0);
    const totalTravelMinutes = daily.reduce((s, d) => s + d.travelMinutes, 0);
    // Sum daily earnings (each may use a different rate) rather than multiplying
    // totalWorkMinutes by a single rate — the only correct approach when rates differ per day.
    const totalEarnings = Math.round(daily.reduce((s, d) => s + d.earnings, 0) * 100) / 100;

    return { hourlyRate: currentRate, totalWorkMinutes, totalTravelMinutes, totalEarnings, jobs: jobResults, daily };
  }

  async getJobChatList(userId: number, role: string): Promise<Array<{
    jobId: number; title: string; status: string;
    lastMessage: string | null; lastMessageAt: string | null; unreadCount: number;
  }>> {
    let jobRows: Job[];
    if (role === "technician") {
      const tech = await this.getTechnicianByUserId(userId);
      jobRows = tech ? await this.getJobsByTechnician(tech.id) : [];
    } else {
      jobRows = await this.getAllJobs();
    }

    if (jobRows.length === 0) return [];
    const jobIds = jobRows.map(j => j.id);

    // Batch: all notes for these jobs sorted desc.
    // Used for both last-note-per-job and unread counts.
    const allNotes = await db
      .select({ jobId: jobNotes.jobId, id: jobNotes.id, userId: jobNotes.userId, content: jobNotes.content, createdAt: jobNotes.createdAt })
      .from(jobNotes)
      .where(inArray(jobNotes.jobId, jobIds))
      .orderBy(desc(jobNotes.id));
    const lastNoteMap: Record<number, { id: number; content: string; createdAt: Date }> = {};
    for (const r of allNotes) {
      if (!(r.jobId in lastNoteMap)) {
        lastNoteMap[r.jobId] = { id: r.id, content: r.content, createdAt: r.createdAt };
      }
    }

    // Only process jobs that have at least one note
    const activeJobIds = jobIds.filter(id => lastNoteMap[id]);
    if (activeJobIds.length === 0) return [];

    // Batch: read thresholds for this user (1 query)
    const readRows = await db
      .select({ jobId: jobNoteReads.jobId, lastReadNoteId: jobNoteReads.lastReadNoteId })
      .from(jobNoteReads)
      .where(and(eq(jobNoteReads.userId, userId), inArray(jobNoteReads.jobId, activeJobIds)));
    const readMap: Record<number, number> = {};
    for (const r of readRows) readMap[r.jobId] = r.lastReadNoteId;

    // Derive unread counts in JS from allNotes + readMap
    const unreadMap: Record<number, number> = {};
    for (const r of allNotes) {
      if (r.id > (readMap[r.jobId] ?? 0) && r.userId !== userId) {
        unreadMap[r.jobId] = (unreadMap[r.jobId] ?? 0) + 1;
      }
    }

    const jobMap: Record<number, Job> = {};
    for (const j of jobRows) jobMap[j.id] = j;

    return activeJobIds
      .map(jobId => {
        const lastNote = lastNoteMap[jobId];
        const job = jobMap[jobId];
        return {
          jobId: job.id,
          title: job.title,
          status: job.status,
          lastMessage: lastNote.content.slice(0, 80),
          lastMessageAt: lastNote.createdAt ? new Date(lastNote.createdAt).toISOString() : null,
          unreadCount: unreadMap[jobId] ?? 0,
        };
      })
      .sort((a, b) => new Date(b.lastMessageAt!).getTime() - new Date(a.lastMessageAt!).getTime());
  }

  async ensureTeamMember(userId: number): Promise<void> {
    const [teamConv] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.type, "team"))
      .limit(1);
    if (!teamConv) return; // team conversation not yet bootstrapped
    await db
      .insert(conversationMembers)
      .values({ conversationId: teamConv.id, userId })
      .onConflictDoNothing();
  }

  // ─── Requests ────────────────────────────────────────────────────────────────
  async getAllRequests(): Promise<Request[]> {
    return db.select().from(requests).orderBy(desc(requests.createdAt));
  }

  async getRequestsByCustomerId(customerId: number): Promise<Request[]> {
    return db.select().from(requests)
      .where(eq(requests.customerId, customerId))
      .orderBy(desc(requests.createdAt));
  }

  async getRequestById(id: number): Promise<Request | undefined> {
    const [req] = await db.select().from(requests).where(eq(requests.id, id));
    return req;
  }

  async createRequest(data: InsertRequest): Promise<Request> {
    const [req] = await db.insert(requests).values(data).returning();
    return req;
  }

  async updateRequest(id: number, data: Partial<InsertRequest>): Promise<Request | undefined> {
    const [req] = await db.update(requests).set(data).where(eq(requests.id, id)).returning();
    return req;
  }

  async deleteRequest(id: number): Promise<void> {
    await db.delete(requests).where(eq(requests.id, id));
  }

  // ─── Services (Products & Services catalog) ───────────────────────────────────
  async getAllServices(): Promise<Service[]> {
    return catalogRepository.getAll();
  }

  async createService(data: InsertService): Promise<Service> {
    return catalogRepository.create(data);
  }

  async updateService(id: number, data: Partial<InsertService>): Promise<Service | undefined> {
    return catalogRepository.update(id, data);
  }

  async deleteService(id: number): Promise<void> {
    return catalogRepository.delete(id);
  }

  // ─── Job number generation ────────────────────────────────────────────────────
  async getNextJobNumber(): Promise<string> {
    return numberingService.nextJobNumber();
  }

}

export const storage = new Storage();
