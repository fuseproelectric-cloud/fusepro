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
const technicianUser = { id: 3, email: "tech@test.com", password: "hashed:password123", name: "Tech User", role: "technician", createdAt: new Date("2025-01-01") };

const sampleEstimate = {
  id: 50,
  jobId: 100,
  customerId: 10,
  requestId: null,
  title: "HVAC Repair Estimate",
  status: "draft",
  lineItems: [{ id: "1", description: "Labor", quantity: 2, unitPrice: 75, total: 150 }],
  subtotal: "150.00",
  tax: "12.38",
  total: "162.38",
  deposit: null,
  depositPaid: false,
  notes: null,
  clientMessage: null,
  validUntil: null,
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

describe("Estimates API", () => {
  let app: Express;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  beforeEach(() => {
    Object.values(sm).forEach((fn: any) => fn.mockReset());
  });

  describe("GET /api/estimates", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app).get("/api/estimates");
      expect(res.status).toBe(401);
    });

    it("returns all estimates", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getAllEstimates.mockResolvedValue([sampleEstimate]);

      const res = await agent.get("/api/estimates");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id: 50, status: "draft", total: "162.38" });
    });
  });

  describe("GET /api/estimates/:id", () => {
    it("returns estimate by id", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getEstimateById.mockResolvedValue(sampleEstimate);

      const res = await agent.get("/api/estimates/50");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 50, title: "HVAC Repair Estimate" });
    });

    it("returns 404 for non-existent estimate", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getEstimateById.mockResolvedValue(undefined);

      const res = await agent.get("/api/estimates/999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/estimates", () => {
    it("creates estimate and returns 201", async () => {
      const agent = await loginAs(app, adminUser);
      sm.createEstimate.mockResolvedValue(sampleEstimate);

      const res = await agent.post("/api/estimates").send({
        customerId: 10,
        title: "HVAC Repair Estimate",
        status: "draft",
        lineItems: [],
        subtotal: "0",
        tax: "0",
        total: "0",
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 50, title: "HVAC Repair Estimate" });
      expect(sm.createEstimate).toHaveBeenCalledOnce();
    });

    it("returns 400 when required fields are missing", async () => {
      const agent = await loginAs(app, adminUser);

      const res = await agent.post("/api/estimates").send({ title: "No Customer" });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/estimates/:id", () => {
    it("updates estimate status", async () => {
      const agent = await loginAs(app, adminUser);
      sm.updateEstimate.mockResolvedValue({ ...sampleEstimate, status: "awaiting_response" });

      const res = await agent.put("/api/estimates/50").send({ status: "awaiting_response" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("awaiting_response");
    });

    it("returns 404 when estimate not found", async () => {
      const agent = await loginAs(app, adminUser);
      sm.updateEstimate.mockResolvedValue(undefined);

      const res = await agent.put("/api/estimates/999").send({ status: "approved" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/estimates/:id", () => {
    it("admin can delete estimate", async () => {
      const agent = await loginAs(app, adminUser);
      sm.deleteEstimate.mockResolvedValue(undefined);

      const res = await agent.delete("/api/estimates/50");
      expect(res.status).toBe(200);
      expect(sm.deleteEstimate).toHaveBeenCalledWith(50);
    });

    it("technician cannot delete estimate", async () => {
      const agent = await loginAs(app, technicianUser);

      const res = await agent.delete("/api/estimates/50");
      expect(res.status).toBe(403);
    });
  });
});
