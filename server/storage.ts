import { customerAddressService } from "./services/customer-address.service";
import { inventoryRepository } from "./modules/inventory/inventory.repository";
import { catalogRepository } from "./modules/catalog/catalog.repository";
import { notificationsRepository } from "./modules/notifications/notifications.repository";
import { settingsRepository } from "./modules/settings/settings.repository";
import { timesheetsRepository } from "./modules/timesheets/timesheets.repository";
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
  type User, type InsertUser,
  type Customer, type InsertCustomer,
  type CustomerAddress, type InsertCustomerAddress,
  type Technician, type InsertTechnician,
  type Job, type InsertJob,
  type Estimate, type InsertEstimate,
  type Invoice, type InsertInvoice,
  type InventoryItem, type InsertInventoryItem,
  type JobNote, type InsertJobNote,
  type AdminSetting,
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
    return settingsRepository.getAll();
  }

  async getSetting(key: string): Promise<AdminSetting | undefined> {
    return settingsRepository.getByKey(key);
  }

  async upsertSetting(key: string, value: string): Promise<AdminSetting> {
    return settingsRepository.upsert(key, value);
  }

  // ─── Timesheets ─────────────────────────────────────────────────────────────
  async getTodayTimesheets(technicianId: number): Promise<(Timesheet & { jobTitle?: string | null })[]> {
    return timesheetsRepository.getTodayEntries(technicianId);
  }

  async getWeekTimesheets(technicianId: number, weekOf?: string): Promise<(Timesheet & { jobTitle?: string | null })[]> {
    return timesheetsRepository.getWeekEntries(technicianId, weekOf);
  }

  async approveTimesheetDay(technicianId: number, date: string, approvedBy: number): Promise<void> {
    return timesheetsRepository.approveDay(technicianId, date, approvedBy);
  }

  async unapproveTimesheetDay(technicianId: number, date: string): Promise<void> {
    return timesheetsRepository.unapproveDay(technicianId, date);
  }

  async getTimesheetApprovals(technicianId: number, dates: string[]): Promise<Record<string, { approvedBy: number; approvedAt: Date; snapshotRate: string | null }>> {
    return timesheetsRepository.getApprovals(technicianId, dates);
  }

  async createTimesheetEntry(data: InsertTimesheet): Promise<Timesheet> {
    return timesheetsRepository.create(data);
  }

  async getTimesheetEntryById(id: number): Promise<Timesheet | null> {
    return timesheetsRepository.getById(id);
  }

  async updateTimesheetEntry(id: number, data: { entryType?: string; timestamp?: Date; notes?: string | null }): Promise<Timesheet | null> {
    return timesheetsRepository.update(id, data);
  }

  async deleteTimesheetEntry(id: number): Promise<void> {
    return timesheetsRepository.delete(id);
  }

  async getTimesheetEntriesByJob(jobId: number): Promise<(Timesheet & { technicianName?: string | null })[]> {
    return timesheetsRepository.getEntriesByJob(jobId);
  }

  async getLastTimesheetEntry(technicianId: number, entryType?: string): Promise<Timesheet | null> {
    return timesheetsRepository.getLastEntry(technicianId, entryType);
  }

  async getTechnicianCurrentStatus(technicianId: number): Promise<{
    isDayStarted: boolean;
    isOnBreak: boolean;
    activeJobId: number | null;
    dayStartTime: Date | null;
    totalWorkMinutesToday: number;
    totalTravelMinutesToday: number;
  }> {
    return timesheetsRepository.getCurrentStatus(technicianId);
  }

  // ─── Admin Timesheet (all technicians) ──────────────────────────────────────
  async getAllTimesheetsByDate(dateStrOrDate: Date | string): Promise<{
    technicianId: number;
    technicianName: string;
    technicianColor: string;
    entries: (Timesheet & { jobTitle?: string | null })[];
  }[]> {
    return timesheetsRepository.getAllByDate(dateStrOrDate);
  }

  async getAllTimesheetsByRange(fromStr: string, toStr: string): Promise<{
    technicianId: number;
    technicianName: string;
    technicianColor: string;
    entries: (Timesheet & { jobTitle?: string | null })[];
  }[]> {
    return timesheetsRepository.getAllByRange(fromStr, toStr);
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
    return notificationsRepository.upsertMessage(userId, jobId, data);
  }

  async createActivityNotification(userId: number, data: {
    fromName: string;
    jobId: number | null;
    jobTitle: string | null;
    text: string;
    timestamp: Date;
    entryType: string;
  }): Promise<void> {
    return notificationsRepository.createActivity(userId, data);
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
    return timesheetsRepository.getEarnings(technicianId, fromStr, toStr);
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
