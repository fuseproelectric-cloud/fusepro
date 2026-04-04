import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const sm = vi.hoisted(() => {
  const f = vi.fn;
  return {
    getUserById: f(), getUserByEmail: f(), getAllUsers: f(), createUser: f(), updateUser: f(), deleteUser: f(),
    getAllCustomers: f(), getCustomerById: f(), createCustomer: f(), updateCustomer: f(), deleteCustomer: f(),
    getAddressesByCustomer: f(), createCustomerAddress: f(), updateCustomerAddress: f(), deleteCustomerAddress: f(),
    getAllTechnicians: f(), getTechnicianById: f(), getTechnicianByUserId: f(), createTechnician: f(), updateTechnician: f(), deleteTechnician: f(),
    getTechnicianEarnings: f(), getTechnicianMyStats: f(), getJobsByTechnicianWithCustomer: f(), getTechnicianCurrentStatus: f(),
    getAllJobs: f(), getJobById: f(), getJobsByCustomer: f(), createJob: f(), updateJob: f(), deleteJob: f(), getNextJobNumber: f(),
    getJobNotes: f(), createJobNote: f(), markJobNoteRead: f(), markJobNotificationsRead: f(),
    getJobMaterials: f(), createJobMaterial: f(), deleteJobMaterial: f(),
    getAllEstimates: f(), getEstimateById: f(), createEstimate: f(), updateEstimate: f(), deleteEstimate: f(),
    getAllInvoices: f(), getInvoiceById: f(), createInvoice: f(), updateInvoice: f(), deleteInvoice: f(), getNextInvoiceNumber: f(),
    getAllInventory: f(), getInventoryById: f(), createInventoryItem: f(), updateInventoryItem: f(), deleteInventoryItem: f(),
    getAllSettings: f(), getSetting: f(), upsertSetting: f(),
    getAllRequests: f(), getRequestById: f(), createRequest: f(), updateRequest: f(), deleteRequest: f(),
    getAllServices: f(), getServiceById: f(), createService: f(), updateService: f(), deleteService: f(),
    getTodayTimesheets: f(), getWeekTimesheets: f(), createTimesheetEntry: f(), updateTimesheetEntry: f(), deleteTimesheetEntry: f(),
    getTimesheetEntriesByJob: f(), approveTimesheetDay: f(), unapproveTimesheetDay: f(), getTimesheetApprovals: f(),
    getAllTimesheetsByDate: f(), getAllTimesheetsByRange: f(), getDashboardStats: f(),
    getUnreadNotifications: f(), markNotificationRead: f(), createActivityNotification: f(), upsertMessageNotification: f(), getAdminAndDispatcherUserIds: f(),
    getChatMessages: f(), createChatMessage: f(), getChatUnreadCount: f(), markChatRead: f(),
    getConversationsForUser: f(), createConversation: f(), getOrCreateDirectConversation: f(), getConvMessages: f(), createConvMessage: f(),
    markConvRead: f(), updateConversationName: f(), addConvMember: f(), removeConvMember: f(), getConvMembers: f(), getJobChatList: f(), ensureTeamMember: f(),
  };
});

vi.mock("../../server/index", () => ({ log: vi.fn() }));
vi.mock("../../server/db", () => ({ pool: { query: vi.fn(), end: vi.fn() }, db: {} }));
vi.mock("../../server/storage", () => ({ storage: sm }));

// Repository mocks — invoices routes now call invoicesRepository directly
vi.mock("../../server/modules/invoices/invoices.repository", () => ({
  invoicesRepository: {
    getAll:               (...a: any[]) => sm.getAllInvoices(...a),
    getById:              (...a: any[]) => sm.getInvoiceById(...a),
    getByEstimateId:      (...a: any[]) => sm.getInvoiceByEstimateId?.(...a),
    create:               (...a: any[]) => sm.createInvoice(...a),
    update:               (...a: any[]) => sm.updateInvoice(...a),
    delete:               (...a: any[]) => sm.deleteInvoice(...a),
    getNextInvoiceNumber: (...a: any[]) => sm.getNextInvoiceNumber(...a),
  },
}));

vi.mock("connect-pg-simple", () => {
  const sessions = new Map<string, any>();
  return {
    default: () => {
      class MockPgStore {
        private _ev: Map<string, Function[]> = new Map();
        on(e: string, fn: Function) { const a = this._ev.get(e) ?? []; a.push(fn); this._ev.set(e, a); return this; }
        emit(e: string, ...args: any[]) { (this._ev.get(e) ?? []).forEach(f => f(...args)); return true; }
        removeListener(_e: string, _fn: Function) { return this; }
        createSession(req: any, sess: any) {
          const s = Object.assign(Object.create({
            save(cb: Function) { sessions.set(req.sessionID, this); process.nextTick(() => cb(null)); return this; },
            destroy(cb: Function) { sessions.delete(req.sessionID); delete req.session; cb(null); return this; },
            touch() { return this; },
            resetMaxAge() { return this; },
            reload(cb: Function) { cb(null); return this; },
            regenerate(cb: Function) {
              sessions.delete(req.sessionID);
              req.sessionID = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
              const fresh: any = Object.assign(Object.create(Object.getPrototypeOf(this)), { id: req.sessionID, cookie: this.cookie });
              req.session = fresh;
              cb(null); return this;
            },
          }), sess, { id: req.sessionID });
          req.session = s;
          return s;
        }
        get(sid: string, cb: Function) { cb(null, sessions.get(sid) ?? null); }
        set(sid: string, data: any, cb: Function) { sessions.set(sid, data); cb(null); }
        destroy(sid: string, cb: Function) { sessions.delete(sid); cb(null); }
        touch(sid: string, data: any, cb: Function) { sessions.set(sid, data); cb(null); }
      }
      return MockPgStore;
    },
  };
});
vi.mock("socket.io", () => {
  class MockIo {
    on = vi.fn();
    to = vi.fn().mockReturnThis();
    emit = vi.fn();
    use = vi.fn();
  }
  return { Server: MockIo };
});
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (pwd: string) => `hashed:${pwd}`),
    compare: vi.fn(async (pwd: string, hash: string) => Promise.resolve(hash === `hashed:${pwd}`)),
  },
}));

import { createTestApp } from "../helpers/createTestApp";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const adminUser = { id: 1, email: "admin@test.com", password: "hashed:password123", name: "Admin User", role: "admin", createdAt: new Date("2025-01-01") };
const dispatcherUser = { id: 2, email: "dispatcher@test.com", password: "hashed:password123", name: "Dispatcher User", role: "dispatcher", createdAt: new Date("2025-01-01") };

const sampleInvoice = {
  id: 200,
  jobId: 100,
  estimateId: 50,
  customerId: 10,
  invoiceNumber: "INV-00001",
  subject: "HVAC Repair",
  status: "draft",
  paymentTerms: "due_on_receipt",
  allowPartialPayment: false,
  lineItems: [{ id: "1", description: "Labor", quantity: 2, unitPrice: 75, total: 150 }],
  subtotal: "150.00",
  tax: "12.38",
  total: "162.38",
  dueDate: null,
  paidAt: null,
  notes: null,
  clientMessage: null,
  createdAt: new Date("2025-01-01"),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

let loginCounter = 0;
async function loginAs(app: Express, user: typeof adminUser) {
  sm.getUserByEmail.mockResolvedValue(user);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").set("X-Forwarded-For", `10.0.${Math.floor(loginCounter / 254)}.${loginCounter % 254 + 1}`).send({ email: user.email, password: "password123" });
  loginCounter++;
  sm.getUserById.mockResolvedValue(user);
  return agent;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Invoices API", () => {
  let app: Express;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  beforeEach(() => {
    Object.values(sm).forEach((fn: any) => fn.mockReset());
  });

  describe("GET /api/invoices", () => {
    it("returns all invoices", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getAllInvoices.mockResolvedValue([sampleInvoice]);

      const res = await agent.get("/api/invoices");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ invoiceNumber: "INV-00001", status: "draft" });
    });
  });

  describe("GET /api/invoices/:id", () => {
    it("returns invoice by id", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getInvoiceById.mockResolvedValue(sampleInvoice);

      const res = await agent.get("/api/invoices/200");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 200, invoiceNumber: "INV-00001" });
    });

    it("returns 404 for non-existent invoice", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getInvoiceById.mockResolvedValue(undefined);

      const res = await agent.get("/api/invoices/999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/invoices", () => {
    it("creates invoice with auto-generated invoice number", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getNextInvoiceNumber.mockResolvedValue("INV-00001");
      sm.createInvoice.mockResolvedValue(sampleInvoice);

      const res = await agent.post("/api/invoices").send({
        customerId: 10,
        subject: "HVAC Repair",
        status: "draft",
        paymentTerms: "due_on_receipt",
        lineItems: [],
        subtotal: "0",
        tax: "0",
        total: "0",
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ invoiceNumber: "INV-00001" });
      expect(sm.getNextInvoiceNumber).toHaveBeenCalledOnce();
      expect(sm.createInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ invoiceNumber: "INV-00001" })
      );
    });

    it("returns 400 when customerId is missing", async () => {
      const agent = await loginAs(app, adminUser);

      const res = await agent.post("/api/invoices").send({ subject: "No customer" });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/invoices/:id", () => {
    it("marks invoice as paid", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getInvoiceById.mockResolvedValue({ ...sampleInvoice, status: "sent" });
      sm.updateInvoice.mockResolvedValue({ ...sampleInvoice, status: "paid", paidAt: new Date() });

      const res = await agent.put("/api/invoices/200").send({ status: "paid" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("paid");
    });

    it("returns 404 when invoice not found", async () => {
      const agent = await loginAs(app, adminUser);
      sm.updateInvoice.mockResolvedValue(undefined);

      const res = await agent.put("/api/invoices/999").send({ status: "sent" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/invoices/:id", () => {
    it("admin can delete invoice", async () => {
      const agent = await loginAs(app, adminUser);
      sm.deleteInvoice.mockResolvedValue(undefined);

      const res = await agent.delete("/api/invoices/200");
      expect(res.status).toBe(200);
      expect(sm.deleteInvoice).toHaveBeenCalledWith(200);
    });

    it("dispatcher cannot delete invoice", async () => {
      const agent = await loginAs(app, dispatcherUser);

      const res = await agent.delete("/api/invoices/200");
      expect(res.status).toBe(403);
    });
  });

  describe("Invoice number format", () => {
    it("generates correct invoice number format INV-XXXXX", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getNextInvoiceNumber.mockResolvedValue("INV-00042");
      sm.createInvoice.mockResolvedValue({ ...sampleInvoice, invoiceNumber: "INV-00042" });

      const res = await agent.post("/api/invoices").send({
        customerId: 10,
        status: "draft",
        paymentTerms: "due_on_receipt",
        lineItems: [],
        subtotal: "0",
        tax: "0",
        total: "0",
      });

      expect(res.status).toBe(201);
      expect(res.body.invoiceNumber).toMatch(/^INV-\d{5}$/);
    });
  });
});
