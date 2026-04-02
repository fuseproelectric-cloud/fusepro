import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

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
    getEstimateByRequestId: f(), getJobByRequestId: f(), getTimesheetEntryById: f(), getInvoiceByEstimateId: f(),
    getUnreadNotifications: f(), markNotificationRead: f(), createActivityNotification: f(), upsertMessageNotification: f(), getAdminAndDispatcherUserIds: f(),
    getChatMessages: f(), createChatMessage: f(), getChatUnreadCount: f(), markChatRead: f(),
    getConversationsForUser: f(), createConversation: f(), getOrCreateDirectConversation: f(), getConvMessages: f(), createConvMessage: f(),
    markConvRead: f(), updateConversationName: f(), addConvMember: f(), removeConvMember: f(), getConvMembers: f(), getJobChatList: f(), ensureTeamMember: f(),
  };
});

const estConvSvcMock = vi.hoisted(() => ({
  toInvoice: vi.fn(),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../server/index",   () => ({ log: vi.fn() }));
vi.mock("../../server/db",      () => ({ pool: { query: vi.fn(), end: vi.fn() }, db: {} }));
vi.mock("../../server/storage", () => ({ storage: sm }));

vi.mock("../../server/services/estimate-conversion.service", async () => {
  const { AppError } = await import("../../server/core/errors/app-error");
  class InvoiceConversionError extends AppError {
    constructor(message: string, statusCode: number) {
      super(message, statusCode, "CONVERSION_ERROR");
      this.name = "InvoiceConversionError";
    }
  }
  return { estimateConversionService: estConvSvcMock, InvoiceConversionError };
});

vi.mock("connect-pg-simple", () => {
  const sessions = new Map();
  return {
    default: () => {
      class S {
        _ev = new Map();
        on(e, fn) { const a = this._ev.get(e) ?? []; a.push(fn); this._ev.set(e, a); return this; }
        emit(e, ...args) { (this._ev.get(e) ?? []).forEach(f => f(...args)); return true; }
        removeListener() { return this; }
        createSession(req, sess) {
          const s = Object.assign(Object.create({
            save(cb) { sessions.set(req.sessionID, this); process.nextTick(() => cb(null)); return this; },
            destroy(cb) { sessions.delete(req.sessionID); delete req.session; cb(null); return this; },
            touch() { return this; },
            resetMaxAge() { return this; },
            reload(cb) { cb(null); return this; },
            regenerate(cb) {
              sessions.delete(req.sessionID);
              req.sessionID = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
              const fresh = Object.assign(Object.create(Object.getPrototypeOf(this)), { id: req.sessionID, cookie: this.cookie });
              req.session = fresh;
              cb(null); return this;
            },
          }), sess, { id: req.sessionID });
          req.session = s;
          return s;
        }
        get(sid, cb) { cb(null, sessions.get(sid) ?? null); }
        set(sid, data, cb) { sessions.set(sid, data); cb(null); }
        destroy(sid, cb) { sessions.delete(sid); cb(null); }
        touch(sid, data, cb) { sessions.set(sid, data); cb(null); }
      }
      return S;
    },
  };
});

vi.mock("socket.io", () => {
  class MockIo {
    on   = vi.fn();
    to   = vi.fn().mockReturnThis();
    emit = vi.fn();
    use  = vi.fn();
  }
  return { Server: MockIo };
});

vi.mock("bcryptjs", () => ({
  default: {
    hash:    vi.fn(async (pwd)       => `hashed:${pwd}`),
    compare: vi.fn(async (pwd, hash) => hash === `hashed:${pwd}`),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

import { createTestApp } from "../helpers/createTestApp";

const adminUser = {
  id: 1, email: "admin@test.com", password: "hashed:password123",
  name: "Admin User", role: "admin", createdAt: new Date("2025-01-01"),
};
const techUser = {
  id: 3, email: "tech@test.com", password: "hashed:password123",
  name: "Tech User", role: "technician", createdAt: new Date("2025-01-01"),
};

const sampleInvoice = {
  id: 200,
  estimateId: 50,
  customerId: 10,
  jobId: null,
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
const sampleEstimate = {
  id: 50, customerId: 10, title: "HVAC Repair", status: "approved",
  lineItems: sampleInvoice.lineItems,
  subtotal: "150.00", tax: "12.38", total: "162.38",
};

let loginCounter = 0;
async function loginAs(app, user) {
  sm.getUserByEmail.mockResolvedValue(user);
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .set("X-Forwarded-For", `10.2.${Math.floor(loginCounter / 254)}.${loginCounter % 254 + 1}`)
    .send({ email: user.email, password: "password123" });
  loginCounter++;
  sm.getUserById.mockResolvedValue(user);
  return agent;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Estimate → Invoice Conversion API", () => {
  let app;
  beforeAll(async () => { ({ app } = await createTestApp()); });
  beforeEach(() => {
    Object.values(sm).forEach((fn) => fn.mockReset());
    estConvSvcMock.toInvoice.mockReset();
  });

  // ── Auth protection ─────────────────────────────────────────────────────────

  describe("auth protection", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await request(app).post("/api/estimates/50/convert-invoice");
      expect(res.status).toBe(401);
    });

    it("returns 403 for technician role", async () => {
      const agent = await loginAs(app, techUser);
      const res = await agent.post("/api/estimates/50/convert-invoice");
      expect(res.status).toBe(403);
    });
  });

  // ── Successful conversion ───────────────────────────────────────────────────

  describe("POST /api/estimates/:id/convert-invoice — success", () => {
    it("returns 201 with the created invoice", async () => {
      const agent = await loginAs(app, adminUser);
      estConvSvcMock.toInvoice.mockResolvedValue({
        estimate: { ...sampleEstimate, status: "converted" },
        invoice:  sampleInvoice,
      });

      const res = await agent.post("/api/estimates/50/convert-invoice");
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: 200,
        estimateId: 50,
        invoiceNumber: "INV-00001",
        status: "draft",
      });
    });

    it("passes estimateId and performedBy to the service", async () => {
      const agent = await loginAs(app, adminUser);
      estConvSvcMock.toInvoice.mockResolvedValue({
        estimate: { ...sampleEstimate, status: "converted" },
        invoice:  sampleInvoice,
      });

      await agent.post("/api/estimates/50/convert-invoice");
      expect(estConvSvcMock.toInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ estimateId: 50, performedBy: adminUser.id }),
      );
    });

    it("forwards optional paymentTerms to the service", async () => {
      const agent = await loginAs(app, adminUser);
      estConvSvcMock.toInvoice.mockResolvedValue({
        estimate: { ...sampleEstimate, status: "converted" },
        invoice:  { ...sampleInvoice, paymentTerms: "net_30", dueDate: new Date() },
      });

      await agent.post("/api/estimates/50/convert-invoice").send({ paymentTerms: "net_30" });
      expect(estConvSvcMock.toInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ paymentTerms: "net_30" }),
      );
    });
  });

  // ── Duplicate conversion rejection ──────────────────────────────────────────

  describe("duplicate conversion rejection", () => {
    it("returns 409 with CONVERSION_ERROR when estimate is already converted", async () => {
      const agent = await loginAs(app, adminUser);
      const { InvoiceConversionError } = await import("../../server/services/estimate-conversion.service");
      estConvSvcMock.toInvoice.mockRejectedValue(
        new InvoiceConversionError("Estimate is already converted.", 409),
      );

      const res = await agent.post("/api/estimates/50/convert-invoice");
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONVERSION_ERROR");
      expect(res.body.error.message).toMatch(/already converted/i);
    });
  });

  // ── Non-convertible state rejection ─────────────────────────────────────────

  describe("non-convertible state rejection", () => {
    it("returns 422 with CONVERSION_ERROR for draft estimate", async () => {
      const agent = await loginAs(app, adminUser);
      const { InvoiceConversionError } = await import("../../server/services/estimate-conversion.service");
      estConvSvcMock.toInvoice.mockRejectedValue(
        new InvoiceConversionError("Only approved estimates can be converted to invoices. Current status: draft.", 422),
      );

      const res = await agent.post("/api/estimates/50/convert-invoice");
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("CONVERSION_ERROR");
      expect(res.body.error.message).toMatch(/draft/i);
    });

    it("returns 422 with CONVERSION_ERROR for archived estimate", async () => {
      const agent = await loginAs(app, adminUser);
      const { InvoiceConversionError } = await import("../../server/services/estimate-conversion.service");
      estConvSvcMock.toInvoice.mockRejectedValue(
        new InvoiceConversionError("Cannot convert an archived estimate.", 422),
      );

      const res = await agent.post("/api/estimates/50/convert-invoice");
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("CONVERSION_ERROR");
      expect(res.body.error.message).toMatch(/archived/i);
    });

    it("returns 404 when estimate does not exist", async () => {
      const agent = await loginAs(app, adminUser);
      const { InvoiceConversionError } = await import("../../server/services/estimate-conversion.service");
      estConvSvcMock.toInvoice.mockRejectedValue(
        new InvoiceConversionError("Estimate not found.", 404),
      );

      const res = await agent.post("/api/estimates/999/convert-invoice");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CONVERSION_ERROR");
    });
  });

  // ── Error response shape ────────────────────────────────────────────────────

  describe("error response shape", () => {
    it("uses { error: { code, message } } envelope — not old { message } shape", async () => {
      const agent = await loginAs(app, adminUser);
      const { InvoiceConversionError } = await import("../../server/services/estimate-conversion.service");
      estConvSvcMock.toInvoice.mockRejectedValue(
        new InvoiceConversionError("Estimate is already converted.", 409),
      );

      const res = await agent.post("/api/estimates/50/convert-invoice");
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatchObject({
        code: "CONVERSION_ERROR",
        message: expect.any(String),
      });
      expect(res.body).not.toHaveProperty("message");
    });
  });

});
