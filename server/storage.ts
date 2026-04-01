import { eq, desc, and, gte, lt, inArray, asc } from "drizzle-orm";
import { db } from "./db";
import { dayBoundsCT, weekBoundsCT, dateStrCT } from "./lib/time";
import { customerAddressService } from "./services/customer-address.service";
import { inventoryRepository } from "./modules/inventory/inventory.repository";
import { catalogRepository } from "./modules/catalog/catalog.repository";
import { notificationsRepository } from "./modules/notifications/notifications.repository";
import { dashboardRepository } from "./modules/dashboard/dashboard.repository";
import { usersRepository } from "./modules/users/users.repository";
import { techniciansRepository } from "./modules/technicians/technicians.repository";
import { customersRepository } from "./modules/customers/customers.repository";
import { requestsRepository } from "./modules/requests/requests.repository";
import { estimatesRepository } from "./modules/estimates/estimates.repository";
import { invoicesRepository } from "./modules/invoices/invoices.repository";
import { conversationsRepository } from "./modules/conversations/conversations.repository";
import { jobNotesRepository } from "./modules/jobs/notes/job-notes.repository";
import { jobMaterialsRepository } from "./modules/jobs/materials/job-materials.repository";
import { jobsRepository } from "./modules/jobs/jobs.repository";
import {
  users, technicians, jobs,
  inventory, adminSettings, timesheets, notifications,
  timesheetApprovals,
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
    return usersRepository.getById(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return usersRepository.getByEmail(email);
  }

  async getAllUsers(): Promise<User[]> {
    return usersRepository.getAll();
  }

  async createUser(data: InsertUser): Promise<User> {
    return usersRepository.create(data);
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    return usersRepository.update(id, data);
  }

  async deleteUser(id: number): Promise<void> {
    return usersRepository.delete(id);
  }

  // ─── Customers ──────────────────────────────────────────────────────────────
  async getAllCustomers(): Promise<Customer[]> {
    return customersRepository.getAll();
  }

  async getCustomerById(id: number): Promise<Customer | undefined> {
    return customersRepository.getById(id);
  }

  async createCustomer(data: InsertCustomer): Promise<Customer> {
    return customersRepository.create(data);
  }

  async updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    return customersRepository.update(id, data);
  }

  async deleteCustomer(id: number): Promise<void> {
    return customersRepository.delete(id);
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
    return techniciansRepository.getAll();
  }

  async getTechnicianById(id: number): Promise<(Technician & { user?: User }) | undefined> {
    return techniciansRepository.getById(id);
  }

  async getTechnicianByUserId(userId: number): Promise<Technician | undefined> {
    return techniciansRepository.getByUserId(userId);
  }

  async createTechnician(data: InsertTechnician): Promise<Technician> {
    return techniciansRepository.create(data);
  }

  async updateTechnician(id: number, data: Partial<InsertTechnician>): Promise<Technician | undefined> {
    return techniciansRepository.update(id, data);
  }

  async deleteTechnician(id: number): Promise<void> {
    return techniciansRepository.delete(id);
  }

  // ─── Jobs ───────────────────────────────────────────────────────────────────
  async getAllJobs(): Promise<Job[]> {
    return jobsRepository.getAll();
  }

  async getJobById(id: number): Promise<Job | undefined> {
    return jobsRepository.getById(id);
  }

  /** Returns the job created from a given request, or undefined if none exists. */
  async getJobByRequestId(requestId: number): Promise<Job | undefined> {
    return jobsRepository.getByRequestId(requestId);
  }

  async getJobByIdWithCustomerSummary(id: number): Promise<(Job & {
    customerSummary: { name: string; phone: string | null } | null;
  }) | undefined> {
    return jobsRepository.getByIdWithCustomerSummary(id);
  }

  async getJobsByCustomer(customerId: number): Promise<Job[]> {
    return jobsRepository.getByCustomer(customerId);
  }

  async getJobsByTechnician(technicianId: number): Promise<Job[]> {
    return jobsRepository.getByTechnician(technicianId);
  }

  async createJob(data: InsertJob): Promise<Job> {
    return jobsRepository.create(data);
  }

  async updateJob(id: number, data: Partial<InsertJob>): Promise<Job | undefined> {
    return jobsRepository.update(id, data);
  }

  async deleteJob(id: number): Promise<void> {
    return jobsRepository.delete(id);
  }

  // ─── Estimates ──────────────────────────────────────────────────────────────
  async getAllEstimates(): Promise<Estimate[]> {
    return estimatesRepository.getAll();
  }

  async getEstimateById(id: number): Promise<Estimate | undefined> {
    return estimatesRepository.getById(id);
  }

  /** Returns the estimate created from a given request, or undefined if none exists. */
  async getEstimateByRequestId(requestId: number): Promise<Estimate | undefined> {
    return estimatesRepository.getByRequestId(requestId);
  }

  async createEstimate(data: InsertEstimate): Promise<Estimate> {
    return estimatesRepository.create(data);
  }

  async updateEstimate(id: number, data: Partial<InsertEstimate>): Promise<Estimate | undefined> {
    return estimatesRepository.update(id, data);
  }

  async deleteEstimate(id: number): Promise<void> {
    return estimatesRepository.delete(id);
  }

  // ─── Invoices ───────────────────────────────────────────────────────────────
  async getAllInvoices(): Promise<Invoice[]> {
    return invoicesRepository.getAll();
  }

  async getInvoiceById(id: number): Promise<Invoice | undefined> {
    return invoicesRepository.getById(id);
  }

  /** Returns the invoice created from a given estimate, or undefined if none exists. */
  async getInvoiceByEstimateId(estimateId: number): Promise<Invoice | undefined> {
    return invoicesRepository.getByEstimateId(estimateId);
  }

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    return invoicesRepository.create(data);
  }

  async updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    return invoicesRepository.update(id, data);
  }

  async deleteInvoice(id: number): Promise<void> {
    return invoicesRepository.delete(id);
  }

  async getNextInvoiceNumber(): Promise<string> {
    return invoicesRepository.getNextInvoiceNumber();
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
    return jobNotesRepository.getJobNotes(jobId);
  }

  async createJobNote(data: InsertJobNote): Promise<JobNote> {
    return jobNotesRepository.createJobNote(data);
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
    return jobMaterialsRepository.getJobMaterials(jobId);
  }

  async createJobMaterial(data: InsertJobMaterial): Promise<JobMaterial> {
    return jobMaterialsRepository.createJobMaterial(data);
  }

  async deleteJobMaterial(id: number): Promise<void> {
    return jobMaterialsRepository.deleteJobMaterial(id);
  }

  // ─── Technician-specific job queries ────────────────────────────────────────
  async getJobsByTechnicianWithCustomer(technicianId: number): Promise<(Job & { customerName?: string | null })[]> {
    return jobsRepository.getByTechnicianWithCustomer(technicianId);
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
    return usersRepository.getAdminAndDispatcherUserIds();
  }

  // ─── Conversations ──────────────────────────────────────────────────────────
  async getConversationsForUser(userId: number) {
    return conversationsRepository.getConversationsForUser(userId);
  }

  async getConversationById(id: number): Promise<Conversation | undefined> {
    return conversationsRepository.getConversationById(id);
  }

  async updateConversationName(id: number, name: string): Promise<void> {
    return conversationsRepository.updateConversationName(id, name);
  }

  async createConversation(data: {
    type: string; name?: string; jobId?: number; createdBy: number; memberIds: number[];
  }): Promise<Conversation> {
    return conversationsRepository.createConversation(data);
  }

  async getOrCreateDirectConversation(userId1: number, userId2: number): Promise<Conversation> {
    return conversationsRepository.getOrCreateDirectConversation(userId1, userId2);
  }

  async getConvMessages(conversationId: number, limit = 60, before?: number): Promise<(ConvMessage & { userName: string; userRole: string })[]> {
    return conversationsRepository.getConvMessages(conversationId, limit, before);
  }

  async createConvMessage(conversationId: number, userId: number, content: string): Promise<ConvMessage & { userName: string; userRole: string }> {
    return conversationsRepository.createConvMessage(conversationId, userId, content);
  }

  async markConvRead(conversationId: number, userId: number, lastId: number): Promise<void> {
    return conversationsRepository.markConvRead(conversationId, userId, lastId);
  }

  async getConvMembers(conversationId: number): Promise<Array<{ id: number; name: string; role: string }>> {
    return conversationsRepository.getConvMembers(conversationId);
  }

  async addConvMember(conversationId: number, userId: number): Promise<void> {
    return conversationsRepository.addConvMember(conversationId, userId);
  }

  async removeConvMember(conversationId: number, userId: number): Promise<void> {
    return conversationsRepository.removeConvMember(conversationId, userId);
  }

  async markJobNoteRead(userId: number, jobId: number, lastNoteId: number): Promise<void> {
    return jobNotesRepository.markJobNoteRead(userId, jobId, lastNoteId);
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

  async getJobChatList(userId: number, role: string) {
    return conversationsRepository.getJobChatList(userId, role);
  }

  async ensureTeamMember(userId: number): Promise<void> {
    return conversationsRepository.ensureTeamMember(userId);
  }

  // ─── Requests ────────────────────────────────────────────────────────────────
  async getAllRequests(): Promise<Request[]> {
    return requestsRepository.getAll();
  }

  async getRequestsByCustomerId(customerId: number): Promise<Request[]> {
    return requestsRepository.getByCustomerId(customerId);
  }

  async getRequestById(id: number): Promise<Request | undefined> {
    return requestsRepository.getById(id);
  }

  async createRequest(data: InsertRequest): Promise<Request> {
    return requestsRepository.create(data);
  }

  async updateRequest(id: number, data: Partial<InsertRequest>): Promise<Request | undefined> {
    return requestsRepository.update(id, data);
  }

  async deleteRequest(id: number): Promise<void> {
    return requestsRepository.delete(id);
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
    return jobsRepository.getNextJobNumber();
  }

}

export const storage = new Storage();
