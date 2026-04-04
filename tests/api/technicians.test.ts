/**
 * Authorization tests for the technicians API.
 *
 * Covers:
 *   - GET /api/technicians — admin/dispatcher only (not technician)
 *   - GET /api/technicians/:id — admin/dispatcher only (not technician)
 *   - GET /api/technicians/me — any authenticated user (own profile)
 *   - POST /api/technicians — admin/dispatcher only
 *   - PUT /api/technicians/:id — admin/dispatcher only
 *   - DELETE /api/technicians/:id — admin only
 *   - PUT /api/technicians/:id/rate — admin only
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";

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

vi.mock("../../server/modules/technicians/technicians.repository", () => ({
  techniciansRepository: {
    getAll:      (...a) => sm.getAllTechnicians(...a),
    getById:     (...a) => sm.getTechnicianById(...a),
    getByUserId: (...a) => sm.getTechnicianByUserId(...a),
    create:      (...a) => sm.createTechnician(...a),
    update:      (...a) => sm.updateTechnician(...a),
    delete:      (...a) => sm.deleteTechnician(...a),
  },
}));

vi.mock("../../server/modules/users/users.repository", () => ({
  usersRepository: {
    getById:                      (...a) => sm.getUserById(...a),
    getByEmail:                   (...a) => sm.getUserByEmail(...a),
    getAll:                       (...a) => sm.getAllUsers(...a),
    create:                       (...a) => sm.createUser(...a),
    update:                       (...a) => sm.updateUser(...a),
    delete:                       (...a) => sm.deleteUser(...a),
    getAdminAndDispatcherUserIds: (...a) => sm.getAdminAndDispatcherUserIds(...a),
  },
}));

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
  class MockIo { on = vi.fn(); to = vi.fn().mockReturnThis(); emit = vi.fn(); use = vi.fn(); }
  return { Server: MockIo };
});
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (pwd) => `hashed:${pwd}`),
    compare: vi.fn(async (pwd, hash) => Promise.resolve(hash === `hashed:${pwd}`)),
  },
}));

import { createTestApp } from "../helpers/createTestApp";

const adminUser      = { id: 1, email: "admin@test.com",      password: "hashed:password123", name: "Admin",      role: "admin",      createdAt: new Date() };
const dispatcherUser = { id: 2, email: "dispatch@test.com",   password: "hashed:password123", name: "Dispatcher", role: "dispatcher", createdAt: new Date() };
const technicianUser = { id: 3, email: "tech@test.com",       password: "hashed:password123", name: "Tech",       role: "technician", createdAt: new Date() };
const sampleTech     = { id: 10, userId: 3, phone: "555-0000", skills: ["hvac"], status: "available", currentLat: null, currentLng: null, color: "#f97316", hourlyRate: "25.00" };

let loginCounter = 0;
async function loginAs(app, user) {
  sm.getUserByEmail.mockResolvedValue(user);
  const agent = request.agent(app);
  await agent.post("/api/auth/login")
    .set("X-Forwarded-For", `10.0.${Math.floor(loginCounter / 254)}.${loginCounter % 254 + 1}`)
    .send({ email: user.email, password: "password123" });
  loginCounter++;
  sm.getUserById.mockResolvedValue(user);
  return agent;
}

describe("Technicians API — authorization", () => {
  let app;
  beforeAll(async () => { ({ app } = await createTestApp()); });
  beforeEach(() => { Object.values(sm).forEach((fn) => fn.mockReset()); });

  // ─── GET /api/technicians ────────────────────────────────────────────────────

  describe("GET /api/technicians", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/technicians");
      expect(res.status).toBe(401);
    });

    it("returns 403 when authenticated as technician", async () => {
      const agent = await loginAs(app, technicianUser);
      const res = await agent.get("/api/technicians");
      expect(res.status).toBe(403);
    });

    it("returns 200 for admin", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getAllTechnicians.mockResolvedValue([sampleTech]);
      const res = await agent.get("/api/technicians");
      expect(res.status).toBe(200);
    });

    it("returns 200 for dispatcher", async () => {
      const agent = await loginAs(app, dispatcherUser);
      sm.getAllTechnicians.mockResolvedValue([sampleTech]);
      const res = await agent.get("/api/technicians");
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/technicians/me ─────────────────────────────────────────────────

  describe("GET /api/technicians/me", () => {
    it("returns own profile for technician", async () => {
      const agent = await loginAs(app, technicianUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTech);
      const res = await agent.get("/api/technicians/me");
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/technicians/:id ────────────────────────────────────────────────

  describe("GET /api/technicians/:id", () => {
    it("returns 401 when unauthenticated", async () => {
      expect((await request(app).get("/api/technicians/10")).status).toBe(401);
    });

    it("returns 403 when authenticated as technician", async () => {
      const agent = await loginAs(app, technicianUser);
      const res = await agent.get("/api/technicians/10");
      expect(res.status).toBe(403);
    });

    it("returns 200 for admin", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getTechnicianById.mockResolvedValue(sampleTech);
      expect((await agent.get("/api/technicians/10")).status).toBe(200);
    });

    it("returns 200 for dispatcher", async () => {
      const agent = await loginAs(app, dispatcherUser);
      sm.getTechnicianById.mockResolvedValue(sampleTech);
      expect((await agent.get("/api/technicians/10")).status).toBe(200);
    });
  });

  // ─── POST /api/technicians ───────────────────────────────────────────────────

  describe("POST /api/technicians", () => {
    it("returns 403 when authenticated as technician", async () => {
      const agent = await loginAs(app, technicianUser);
      const res = await agent.post("/api/technicians").send({ userId: 5, phone: "555-1111" });
      expect(res.status).toBe(403);
    });

    it("allows admin to create technician", async () => {
      const agent = await loginAs(app, adminUser);
      sm.createTechnician.mockResolvedValue(sampleTech);
      const res = await agent.post("/api/technicians").send({ userId: 5, phone: "555-1111", status: "available" });
      expect(res.status).toBe(201);
    });
  });

  // ─── PUT /api/technicians/:id ────────────────────────────────────────────────

  describe("PUT /api/technicians/:id", () => {
    it("returns 403 when authenticated as technician", async () => {
      const agent = await loginAs(app, technicianUser);
      const res = await agent.put("/api/technicians/10").send({ phone: "555-9999" });
      expect(res.status).toBe(403);
    });

    it("allows dispatcher to update technician", async () => {
      const agent = await loginAs(app, dispatcherUser);
      sm.updateTechnician.mockResolvedValue(sampleTech);
      const res = await agent.put("/api/technicians/10").send({ phone: "555-9999" });
      expect(res.status).toBe(200);
    });
  });

  // ─── DELETE /api/technicians/:id ─────────────────────────────────────────────

  describe("DELETE /api/technicians/:id", () => {
    it("returns 403 when authenticated as technician", async () => {
      const agent = await loginAs(app, technicianUser);
      expect((await agent.delete("/api/technicians/10")).status).toBe(403);
    });

    it("returns 403 when authenticated as dispatcher", async () => {
      const agent = await loginAs(app, dispatcherUser);
      expect((await agent.delete("/api/technicians/10")).status).toBe(403);
    });

    it("allows admin to delete technician", async () => {
      const agent = await loginAs(app, adminUser);
      sm.deleteTechnician.mockResolvedValue(undefined);
      expect((await agent.delete("/api/technicians/10")).status).toBe(200);
    });
  });

  // ─── PUT /api/technicians/:id/rate ──────────────────────────────────────────

  describe("PUT /api/technicians/:id/rate", () => {
    it("returns 403 for dispatcher", async () => {
      const agent = await loginAs(app, dispatcherUser);
      expect((await agent.put("/api/technicians/10/rate").send({ hourlyRate: 30 })).status).toBe(403);
    });

    it("returns 403 for technician", async () => {
      const agent = await loginAs(app, technicianUser);
      expect((await agent.put("/api/technicians/10/rate").send({ hourlyRate: 30 })).status).toBe(403);
    });

    it("allows admin to update hourly rate", async () => {
      const agent = await loginAs(app, adminUser);
      sm.updateTechnician.mockResolvedValue({ ...sampleTech, hourlyRate: "30.00" });
      expect((await agent.put("/api/technicians/10/rate").send({ hourlyRate: 30 })).status).toBe(200);
    });
  });
});
