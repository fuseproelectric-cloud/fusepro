import { vi } from "vitest";

/**
 * Complete mock of the Storage class.
 * Import this in test files via vi.mock factory.
 * Call resetAll() in beforeEach to clear state between tests.
 */
export const storageMock = {
  // Users
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  getAllUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),

  // Customers
  getAllCustomers: vi.fn(),
  getCustomerById: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deleteCustomer: vi.fn(),

  // Customer Addresses
  getAddressesByCustomer: vi.fn(),
  createCustomerAddress: vi.fn(),
  updateCustomerAddress: vi.fn(),
  deleteCustomerAddress: vi.fn(),

  // Technicians
  getAllTechnicians: vi.fn(),
  getTechnicianById: vi.fn(),
  getTechnicianByUserId: vi.fn(),
  createTechnician: vi.fn(),
  updateTechnician: vi.fn(),
  deleteTechnician: vi.fn(),
  getTechnicianEarnings: vi.fn(),
  getTechnicianMyStats: vi.fn(),
  getJobsByTechnicianWithCustomer: vi.fn(),
  getTechnicianCurrentStatus: vi.fn(),

  // Jobs
  getAllJobs: vi.fn(),
  getJobById: vi.fn(),
  getJobsByCustomer: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  deleteJob: vi.fn(),
  getNextJobNumber: vi.fn(),

  // Job Notes
  getJobNotes: vi.fn(),
  createJobNote: vi.fn(),
  markJobNoteRead: vi.fn(),
  markJobNotificationsRead: vi.fn(),

  // Job Materials
  getJobMaterials: vi.fn(),
  createJobMaterial: vi.fn(),
  deleteJobMaterial: vi.fn(),

  // Estimates
  getAllEstimates: vi.fn(),
  getEstimateById: vi.fn(),
  createEstimate: vi.fn(),
  updateEstimate: vi.fn(),
  deleteEstimate: vi.fn(),

  // Invoices
  getAllInvoices: vi.fn(),
  getInvoiceById: vi.fn(),
  createInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  getNextInvoiceNumber: vi.fn(),

  // Inventory
  getAllInventory: vi.fn(),
  getInventoryById: vi.fn(),
  createInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  deleteInventoryItem: vi.fn(),

  // Settings
  getAllSettings: vi.fn(),
  getSetting: vi.fn(),
  upsertSetting: vi.fn(),

  // Requests
  getAllRequests: vi.fn(),
  getRequestById: vi.fn(),
  createRequest: vi.fn(),
  updateRequest: vi.fn(),
  deleteRequest: vi.fn(),

  // Services
  getAllServices: vi.fn(),
  getServiceById: vi.fn(),
  createService: vi.fn(),
  updateService: vi.fn(),
  deleteService: vi.fn(),

  // Timesheets
  getTodayTimesheets: vi.fn(),
  getWeekTimesheets: vi.fn(),
  createTimesheetEntry: vi.fn(),
  updateTimesheetEntry: vi.fn(),
  deleteTimesheetEntry: vi.fn(),
  getTimesheetEntriesByJob: vi.fn(),
  approveTimesheetDay: vi.fn(),
  unapproveTimesheetDay: vi.fn(),
  getTimesheetApprovals: vi.fn(),
  getAllTimesheetsByDate: vi.fn(),
  getAllTimesheetsByRange: vi.fn(),

  // Dashboard
  getDashboardStats: vi.fn(),

  // Notifications
  getUnreadNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  createActivityNotification: vi.fn(),
  upsertMessageNotification: vi.fn(),
  getAdminAndDispatcherUserIds: vi.fn(),

  // Chat (legacy)
  getChatMessages: vi.fn(),
  createChatMessage: vi.fn(),
  getChatUnreadCount: vi.fn(),
  markChatRead: vi.fn(),

  // Conversations
  getConversationsForUser: vi.fn(),
  createConversation: vi.fn(),
  getOrCreateDirectConversation: vi.fn(),
  getConvMessages: vi.fn(),
  createConvMessage: vi.fn(),
  markConvRead: vi.fn(),
  updateConversationName: vi.fn(),
  addConvMember: vi.fn(),
  removeConvMember: vi.fn(),
  getConvMembers: vi.fn(),
  getJobChatList: vi.fn(),
  ensureTeamMember: vi.fn(),
};

export function resetStorageMock() {
  for (const fn of Object.values(storageMock)) {
    fn.mockReset();
  }
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

export const adminUser = {
  id: 1,
  email: "admin@test.com",
  password: "hashed:password123",
  name: "Admin User",
  role: "admin",
  createdAt: new Date("2025-01-01"),
};

export const dispatcherUser = {
  id: 2,
  email: "dispatcher@test.com",
  password: "hashed:password123",
  name: "Dispatcher User",
  role: "dispatcher",
  createdAt: new Date("2025-01-01"),
};

export const technicianUser = {
  id: 3,
  email: "tech@test.com",
  password: "hashed:password123",
  name: "Tech User",
  role: "technician",
  createdAt: new Date("2025-01-01"),
};

export const sampleCustomer = {
  id: 10,
  name: "Acme Corp",
  email: "acme@example.com",
  phone: "555-1234",
  notes: null,
  tags: ["vip"],
  leadSource: "referral",
  company: "Acme Corp",
  createdAt: new Date("2025-01-01"),
};

export const sampleJob = {
  id: 100,
  jobNumber: "JOB-00001",
  title: "Fix HVAC",
  description: "Replace filter",
  instructions: null,
  customerId: 10,
  technicianId: 1,
  status: "pending",
  priority: "normal",
  invoicingType: "fixed",
  billingSchedule: "on_completion",
  scheduledAt: new Date("2026-04-01T09:00:00Z"),
  estimatedDuration: 60,
  address: "123 Main St",
  city: "Austin",
  state: "TX",
  zip: "78701",
  notes: null,
  completedAt: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

export const sampleTechnician = {
  id: 1,
  userId: 3,
  phone: "555-0000",
  skills: ["hvac"],
  status: "available",
  currentLat: null,
  currentLng: null,
  color: "#f97316",
  hourlyRate: "25.00",
};
