/**
 * Focused tests confirming that all write endpoints reject invalid input
 * through the unified error middleware and return a consistent error shape:
 *   { error: { code: "VALIDATION_ERROR" | "NOT_FOUND" | ..., message: ... } }
 *
 * These tests do NOT exercise business logic — they only verify that:
 *   - non-numeric :id params return 400 VALIDATION_ERROR
 *   - missing required body fields return 400 VALIDATION_ERROR
 *   - the old { message } shape is no longer returned for these cases
 */

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

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../server/index",   () => ({ log: vi.fn() }));
vi.mock("../../server/db",      () => ({ pool: { query: vi.fn(), end: vi.fn() }, db: {} }));
vi.mock("../../server/storage", () => ({ storage: sm }));

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

let loginCounter = 0;
async function loginAs(app, user) {
  sm.getUserByEmail.mockResolvedValue(user);
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .set("X-Forwarded-For", `10.9.${Math.floor(loginCounter / 254)}.${loginCounter % 254 + 1}`)
    .send({ email: user.email, password: "password123" });
  loginCounter++;
  sm.getUserById.mockResolvedValue(user);
  return agent;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Schema-first validation — error shape", () => {
  let app;
  beforeAll(async () => { ({ app } = await createTestApp()); });
  beforeEach(() => Object.values(sm).forEach((fn) => fn.mockReset()));

  // Helper — asserts the unified error envelope is present and no legacy { message } top-level key
  function expectValidationError(res, status = 400) {
    expect(res.status).toBe(status);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(res.body).not.toHaveProperty("message");
  }

  // ── Estimates ──────────────────────────────────────────────────────────────

  describe("POST /api/estimates — invalid body", () => {
    it("returns 400 VALIDATION_ERROR when required fields are missing", async () => {
      const agent = await loginAs(app, adminUser);
      const res = await agent.post("/api/estimates").send({ title: "No customer" });
      expectValidationError(res);
    });
  });

  describe("PUT /api/estimates/:id — invalid param", () => {
    it("returns 400 VALIDATION_ERROR for non-numeric id", async () => {
      const agent = await loginAs(app, adminUser);
      const res = await agent.put("/api/estimates/not-a-number").send({ status: "approved" });
      expectValidationError(res);
    });
  });

  describe("DELETE /api/estimates/:id — invalid param", () => {
    it("returns 400 VALIDATION_ERROR for non-numeric id", async () => {
      const agent = await loginAs(app, adminUser);
      const res = await agent.delete("/api/estimates/abc");
      expectValidationError(res);
    });
  });

  // ── Invoices ───────────────────────────────────────────────────────────────

  describe("PUT /api/invoices/:id — invalid param", () => {
    it("returns 400 VALIDATION_ERROR for non-numeric id", async () => {
      const agent = await loginAs(app, adminUser);
      const res = await agent.put("/api/invoices/bad-id").send({ status: "paid" });
      expectValidationError(res);
    });
  });

  describe("DELETE /api/invoices/:id — invalid param", () => {
    it("returns 400 VALIDATION_ERROR for non-numeric id", async () => {
      const agent = await loginAs(app, adminUser);
      const res = await agent.delete("/api/invoices/xyz");
      expectValidationError(res);
    });
  });

  // ── Requests ───────────────────────────────────────────────────────────────

  describe("POST /api/requests — invalid body", () => {
    it("returns 400 VALIDATION_ERROR when required fields are missing", async () => {
      const agent = await loginAs(app, adminUser);
      const res = await agent.post("/api/requests").send({});
      expectValidationError(res);
    });
  });

  describe("PUT /api/requests/:id — invalid param", () => {
    it("returns 400 VALIDATION_ERROR for non-numeric id", async () => {
      const agent = await loginAs(app, adminUser);
      const res = await agent.put("/api/requests/not-an-id").send({ status: "triaged" });
      expectValidationError(res);
    });
  });

  describe("DELETE /api/requests/:id — invalid param", () => {
    it("returns 400 VALIDATION_ERROR for non-numeric id", async () => {
      const agent = await loginAs(app, adminUser);
      const res = await agent.delete("/api/requests/nope");
      expectValidationError(res);
    });
  });

  // ── Jobs ───────────────────────────────────────────────────────────────────

  describe("POST /api/jobs — invalid body", () => {
    it("returns 400 VALIDATION_ERROR when required fields are missing", async () => {
      const agent = await loginAs(app, adminUser);
      const res = await agent.post("/api/jobs").send({});
      expectValidationError(res);
    });
  });

  describe("PUT /api/jobs/:id — invalid param", () => {
    it("returns 400 VALIDATION_ERROR for non-numeric id", async () => {
      const agent = await loginAs(app, adminUser);
      const res = await agent.put("/api/jobs/bad").send({ status: "in_progress" });
      expectValidationError(res);
    });
  });

  describe("DELETE /api/jobs/:id — invalid param", () => {
    it("returns 400 VALIDATION_ERROR for non-numeric id", async () => {
      const agent = await loginAs(app, adminUser);
      const res = await agent.delete("/api/jobs/nope");
      expectValidationError(res);
    });
  });

});
