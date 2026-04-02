import { eq, desc, and, gte, lt, inArray, asc } from "drizzle-orm";
import { db } from "./db";
import { dayBoundsCT, weekBoundsCT, dateStrCT } from "./lib/time";
import { timesheetsDomainService } from "./modules/timesheets/timesheets.domain-service";
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
    return timesheetsDomainService.computeCurrentStatus(todayEntries);
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

    // Fetch approvals for every date in the result set so the domain service
    // can apply the frozen snapshotRate on approved days.
    const allDates = [...new Set(rows.map((r) => r.ts.timestamp.toISOString().slice(0, 10)))];
    const approvalsMap = allDates.length > 0
      ? await this.getTimesheetApprovals(technicianId, allDates)
      : {} as Record<string, { approvedBy: number; approvedAt: Date; snapshotRate: string | null }>;

    const result = timesheetsDomainService.computeEarnings(rows, currentRate, approvalsMap);
    return { hourlyRate: currentRate, ...result };
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
