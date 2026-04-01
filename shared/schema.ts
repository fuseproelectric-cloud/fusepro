import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  numeric,
  json,
  doublePrecision,
  boolean,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("technician"), // 'admin' | 'dispatcher' | 'technician'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const selectUserSchema = createSelectSchema(users);
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Customers ───────────────────────────────────────────────────────────────
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  notes: text("notes"),
  tags: text("tags").array(),
  leadSource: varchar("lead_source", { length: 100 }),
  company: varchar("company", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const selectCustomerSchema = createSelectSchema(customers);
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ─── Customer Addresses ───────────────────────────────────────────────────────
export const customerAddresses = pgTable("customer_addresses", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  label: varchar("label", { length: 100 }).notNull().default("Service Address"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zip: varchar("zip", { length: 20 }),
  isPrimary: boolean("is_primary").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerAddressSchema = createInsertSchema(customerAddresses).omit({ id: true, createdAt: true });
export const selectCustomerAddressSchema = createSelectSchema(customerAddresses);
export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type InsertCustomerAddress = typeof customerAddresses.$inferInsert;

// ─── Technicians ─────────────────────────────────────────────────────────────
export const technicians = pgTable("technicians", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  phone: varchar("phone", { length: 50 }),
  skills: text("skills").array(),
  // Administrative availability label — set manually by admin/dispatcher only.
  // Valid values: 'available' | 'active' | 'inactive'
  // 'on_job' is DEPRECATED as an active semantic. It must never be set automatically
  // by JobExecutionService or any other service — live operational state is derived
  // from timesheets, not persisted into this field. The API blocks direct writes to
  // 'on_job' (PUT /api/technicians/:id returns 422) to prevent stale label drift.
  // For real-time operational state (is working, active job id, etc.) use
  // storage.getTechnicianCurrentStatus() which reads the timesheet ledger.
  status: varchar("status", { length: 50 }).notNull().default("available"),
  currentLat: doublePrecision("current_lat"),
  currentLng: doublePrecision("current_lng"),
  color: varchar("color", { length: 20 }).default("#f97316"),
  hourlyRate: numeric("hourly_rate", { precision: 8, scale: 2 }).default("25.00"),
});

export const insertTechnicianSchema = createInsertSchema(technicians).omit({ id: true });
export const selectTechnicianSchema = createSelectSchema(technicians);
export type Technician = typeof technicians.$inferSelect;
export type InsertTechnician = typeof technicians.$inferInsert;

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobNumber: varchar("job_number", { length: 50 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  instructions: text("instructions"),
  customerId: integer("customer_id").references(() => customers.id),
  technicianId: integer("technician_id").references(() => technicians.id),
  requestId: integer("request_id"), // FK set in table extras below; populated only on Request → Job conversion
  status: varchar("status", { length: 50 }).notNull().default("pending"), // 'pending'|'assigned'|'in_progress'|'completed'|'cancelled'
  priority: varchar("priority", { length: 50 }).notNull().default("normal"), // 'low'|'normal'|'high'|'emergency'
  // INFORMATIONAL ONLY — no backend logic reads or enforces these fields.
  // They are stored for future billing automation but currently have zero behavioral effect.
  // Do not add conditional logic that branches on these values until a billing engine is built.
  invoicingType: varchar("invoicing_type", { length: 50 }).default("fixed"),   // 'fixed'|'per_visit'
  billingSchedule: varchar("billing_schedule", { length: 50 }).default("on_completion"), // 'as_needed'|'after_each_visit'|'on_completion'|'monthly'
  scheduledAt: timestamp("scheduled_at"),
  estimatedDuration: integer("estimated_duration"), // minutes
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zip: varchar("zip", { length: 20 }),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("jobs_job_number_unique").on(table.jobNumber),
  index("idx_jobs_request_id").on(table.requestId),
]);

export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  scheduledAt: z.coerce.date().optional().nullable(),
  completedAt: z.coerce.date().optional().nullable(),
});
export const selectJobSchema = createSelectSchema(jobs);
export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

// ─── Estimates ────────────────────────────────────────────────────────────────
export const estimates = pgTable("estimates", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  requestId: integer("request_id"), // populated on Request → Estimate conversion
  title: varchar("title", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // 'draft'|'awaiting_response'|'changes_requested'|'approved'|'converted'|'archived'
  lineItems: json("line_items").$type<LineItem[]>().default([]),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).default("0"),
  tax: numeric("tax", { precision: 10, scale: 2 }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).default("0"),
  // ESTIMATE-STAGE COMMERCIAL FIELDS — informational only at this stage.
  // These are NOT propagated to the invoice when the estimate is converted
  // (see EstimateConversionService.toInvoice). There is no deposit-credit or
  // installment-ledger model; depositPaid is a manual flag updated by staff only.
  // Do not use these to infer invoice settlement state.
  deposit: numeric("deposit", { precision: 10, scale: 2 }),
  depositPaid: boolean("deposit_paid").default(false),
  notes: text("notes"),
  clientMessage: text("client_message"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_estimates_request_id").on(table.requestId),
]);

export const insertEstimateSchema = createInsertSchema(estimates).omit({ id: true, createdAt: true }).extend({
  validUntil: z.coerce.date().optional().nullable(),
});
export const selectEstimateSchema = createSelectSchema(estimates);
export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = typeof estimates.$inferInsert;

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id),
  estimateId: integer("estimate_id").references(() => estimates.id), // null for standalone invoices; set on Estimate → Invoice conversion
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
  subject: varchar("subject", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // 'draft'|'sent'|'paid'|'overdue'
  // Presentational/display field shown on printed invoices and in the UI.
  // 'due_on_receipt' → dueDate may remain null.
  // 'net_15'|'net_30'|'net_60' → dueDate should be set (UI auto-suggests on creation;
  //   dispatcher may override). dueDate is NOT automatically re-derived when paymentTerms
  //   is changed post-creation. No scheduler or hook enforces overdue status from this field.
  paymentTerms: varchar("payment_terms", { length: 50 }).default("due_on_receipt"), // 'due_on_receipt'|'net_15'|'net_30'|'net_60'
  // PRESENTATIONAL PREFERENCE FLAG — not enforced by any payment or ledger logic.
  // Stored for future payment-gateway integration. Do not branch on this field
  // to accept or reject partial payments until a real ledger model exists.
  allowPartialPayment: boolean("allow_partial_payment").default(false),
  lineItems: json("line_items").$type<LineItem[]>().default([]),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).default("0"),
  tax: numeric("tax", { precision: 10, scale: 2 }).default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).default("0"),
  // Manually set by dispatcher. For net_* paymentTerms the UI auto-suggests this
  // at creation time (today + N days), but it is always editable and never
  // auto-updated after creation. 'overdue' status is set manually only — no cron
  // or hook compares this field to the current date.
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  clientMessage: text("client_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // Prevents creating more than one invoice per estimate.
  // PostgreSQL UNIQUE on a nullable column allows multiple NULLs,
  // so standalone invoices (estimateId = NULL) are unaffected.
  uniqueIndex("invoices_estimate_id_unique").on(table.estimateId),
  // Safety net for concurrent invoice number generation.
  // getNextInvoiceNumber() is not globally concurrency-safe; this constraint
  // ensures a collision fails hard rather than inserting a duplicate silently.
  // Remove this note once the dedicated numbering refactor is complete.
  uniqueIndex("invoices_invoice_number_unique").on(table.invoiceNumber),
  index("idx_invoices_estimate_id").on(table.estimateId),
]);

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true }).extend({
  dueDate: z.coerce.date().optional().nullable(),
  paidAt: z.coerce.date().optional().nullable(),
});
export const selectInvoiceSchema = createSelectSchema(invoices);
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }),
  category: varchar("category", { length: 100 }),
  quantity: integer("quantity").notNull().default(0),
  minQuantity: integer("min_quantity").default(0),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).default("0"),
  unit: varchar("unit", { length: 50 }),
  location: varchar("location", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInventorySchema = createInsertSchema(inventory).omit({ id: true, createdAt: true, updatedAt: true });
export const selectInventorySchema = createSelectSchema(inventory);
export type InventoryItem = typeof inventory.$inferSelect;
export type InsertInventoryItem = typeof inventory.$inferInsert;

// ─── Job Notes ────────────────────────────────────────────────────────────────
export const jobNotes = pgTable("job_notes", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobNoteSchema = createInsertSchema(jobNotes).omit({ id: true, createdAt: true });
export const selectJobNoteSchema = createSelectSchema(jobNotes);
export type JobNote = typeof jobNotes.$inferSelect;
export type InsertJobNote = typeof jobNotes.$inferInsert;

// ─── Admin Settings ───────────────────────────────────────────────────────────
export const adminSettings = pgTable("admin_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value"),
});

export const insertAdminSettingSchema = createInsertSchema(adminSettings).omit({ id: true });
export type AdminSetting = typeof adminSettings.$inferSelect;
export type InsertAdminSetting = typeof adminSettings.$inferInsert;

// ─── Timesheets ───────────────────────────────────────────────────────────────
export const timesheets = pgTable("timesheets", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id").references(() => technicians.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id),
  entryType: varchar("entry_type", { length: 50 }).notNull(),
  // entry types: 'day_start' | 'day_end' | 'travel_start' | 'travel_end' | 'work_start' | 'work_end' | 'break_start' | 'break_end'
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  notes: text("notes"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertTimesheetSchema = createInsertSchema(timesheets).omit({ id: true, createdAt: true }).extend({
  timestamp: z.coerce.date().optional(),
});
export type Timesheet = typeof timesheets.$inferSelect;
export type InsertTimesheet = typeof timesheets.$inferInsert;

// ─── Timesheet Approvals ──────────────────────────────────────────────────────
export const timesheetApprovals = pgTable("timesheet_approvals", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id").references(() => technicians.id).notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  approvedBy: integer("approved_by").references(() => users.id).notNull(),
  approvedAt: timestamp("approved_at").defaultNow().notNull(),
  // Snapshot of technician.hourlyRate at the moment of approval.
  // Frozen so future rate changes do not retroactively alter approved earnings.
  // NULL for rows created before this column was added (falls back to current rate).
  snapshotRate: numeric("snapshot_rate", { precision: 8, scale: 2 }),
});
export type TimesheetApproval = typeof timesheetApprovals.$inferSelect;

// ─── Job Materials ─────────────────────────────────────────────────────────────
export const jobMaterials = pgTable("job_materials", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1"),
  unit: varchar("unit", { length: 50 }).default("pcs"),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertJobMaterialSchema = createInsertSchema(jobMaterials).omit({ id: true, createdAt: true });
export type JobMaterial = typeof jobMaterials.$inferSelect;
export type InsertJobMaterial = typeof jobMaterials.$inferInsert;

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).notNull(), // 'team'|'group'|'direct'|'job'
  name: varchar("name", { length: 255 }),
  jobId: integer("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Conversation = typeof conversations.$inferSelect;

export const conversationMembers = pgTable("conversation_members", {
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadId: integer("last_read_id").notNull().default(0),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const convMessages = pgTable("conv_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ConvMessage = typeof convMessages.$inferSelect;

// ─── Legacy Chat Tables (DEPRECATED — do not use from application code) ──────
// These tables are retained as dormant history. The application has fully
// migrated to the conversations model (type='team' conversation).
// They will be dropped in a future migration once confirmed safe.
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ChatMessage = typeof chatMessages.$inferSelect;

export const chatReads = pgTable("chat_reads", {
  userId: integer("user_id").primaryKey().references(() => users.id),
  lastReadId: integer("last_read_id").notNull().default(0),
});

export const jobNoteReads = pgTable("job_note_reads", {
  userId: integer("user_id").references(() => users.id).notNull(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  lastReadNoteId: integer("last_read_note_id").notNull().default(0),
}, t => ({ pk: primaryKey({ columns: [t.userId, t.jobId] }) }));

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'message' | 'activity'
  jobId: integer("job_id"),
  jobTitle: text("job_title"),
  fromName: text("from_name").notNull(),
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  entryType: varchar("entry_type", { length: 50 }),
  messageCount: integer("message_count").default(1),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ─── Shared Types ─────────────────────────────────────────────────────────────
export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export const lineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
});

// ─── Requests ─────────────────────────────────────────────────────────────────
// Request is an intake object owned by dispatcher.
// It is the authoritative record for a service request before it becomes an Estimate or Job.
//
// Lifecycle: new → triaged | assessment_scheduled → converted | closed | archived
// Terminal states: converted, closed, archived
// 'converted' can ONLY be set by RequestConversionService (/convert-estimate | /convert-job).
// All updates blocked on terminal statuses.
//
// Ownership: createdByUserId is set by the route on create and never updated.
//            ownerUserId is assignable (defaults to creator).
export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  // Core intake
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  customerId: integer("customer_id").references(() => customers.id),
  serviceAddressId: integer("service_address_id").references(() => customerAddresses.id),
  priority: varchar("priority", { length: 50 }).notNull().default("normal"), // 'emergency'|'high'|'normal'|'low'
  status: varchar("status", { length: 50 }).notNull().default("new"), // 'new'|'triaged'|'assessment_scheduled'|'converted'|'closed'|'archived'
  source: varchar("source", { length: 50 }).notNull().default("manual"), // 'manual'|'phone'|'sms'|'email'|'web'|'portal'|'technician'|'other'
  category: varchar("category", { length: 100 }),
  // Ownership
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  ownerUserId: integer("owner_user_id").references(() => users.id),
  // Contact info (may differ from the customer record — captured at intake)
  customerContactName: varchar("customer_contact_name", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 50 }),
  customerEmail: varchar("customer_email", { length: 255 }),
  preferredContactMethod: varchar("preferred_contact_method", { length: 50 }), // 'phone'|'sms'|'email'
  // Scheduling preferences
  requestedDate: timestamp("requested_date"),
  requestedTimeWindow: varchar("requested_time_window", { length: 100 }),
  isFlexibleSchedule: boolean("is_flexible_schedule").notNull().default(false),
  // Notes
  clientNotes: text("client_notes"),
  internalNotes: text("internal_notes"),
  // Conversion tracking — written ONLY by RequestConversionService
  convertedToType: varchar("converted_to_type", { length: 50 }), // 'estimate'|'job'
  convertedAt: timestamp("converted_at"),
  convertedByUserId: integer("converted_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_requests_owner_user_id").on(table.ownerUserId),
  index("idx_requests_status").on(table.status),
]);

export const insertRequestSchema = createInsertSchema(requests).omit({
  id: true,
  createdAt: true,
  // Conversion tracking is server-managed; clients may never set these.
  convertedToType: true,
  convertedAt: true,
  convertedByUserId: true,
  // createdByUserId is injected by the route handler from the session; not client-supplied.
  createdByUserId: true,
}).extend({
  requestedDate: z.coerce.date().optional().nullable(),
});
export const selectRequestSchema = createSelectSchema(requests);
export type Request = typeof requests.$inferSelect;
export type InsertRequest = typeof requests.$inferInsert;

// ─── Services (Products & Services catalog) ───────────────────────────────────
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).default("0"),
  cost: numeric("cost", { precision: 10, scale: 2 }).default("0"),
  taxable: boolean("taxable").default(true),
  category: varchar("category", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertServiceSchema = createInsertSchema(services).omit({ id: true, createdAt: true });
export const selectServiceSchema = createSelectSchema(services);
export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;
