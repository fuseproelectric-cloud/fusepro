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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Auth API", () => {
  let app: Express;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  beforeEach(() => {
    Object.values(sm).forEach((fn: any) => fn.mockReset());
  });

  describe("POST /api/auth/login", () => {
    it("returns 200 and user on valid credentials", async () => {
      sm.getUserByEmail.mockResolvedValue(adminUser);
      const res = await request(app).post("/api/auth/login").send({ email: "admin@test.com", password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, email: "admin@test.com", role: "admin" });
      expect(res.body.password).toBeUndefined();
    });

    it("returns 401 on wrong password", async () => {
      sm.getUserByEmail.mockResolvedValue(adminUser);
      const res = await request(app).post("/api/auth/login").send({ email: "admin@test.com", password: "wrongpassword" });
      expect(res.status).toBe(401);
    });

    it("returns 401 when user not found", async () => {
      sm.getUserByEmail.mockResolvedValue(undefined);
      const res = await request(app).post("/api/auth/login").send({ email: "nobody@test.com", password: "password123" });
      expect(res.status).toBe(401);
    });

    it("returns 400 when email or password missing", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: "admin@test.com" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("returns 200 and destroys session", async () => {
      sm.getUserByEmail.mockResolvedValue(adminUser);
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "admin@test.com", password: "password123" });
      const res = await agent.post("/api/auth/logout");
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns null when not logged in", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it("returns user when logged in", async () => {
      sm.getUserByEmail.mockResolvedValue(adminUser);
      sm.getUserById.mockResolvedValue(adminUser);
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "admin@test.com", password: "password123" });
      const res = await agent.get("/api/auth/me");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 1, email: "admin@test.com" });
    });
  });

  describe("PUT /api/auth/password", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app).put("/api/auth/password").send({ currentPassword: "old", newPassword: "new" });
      expect(res.status).toBe(401);
    });

    it("changes password when authenticated and current password is correct", async () => {
      sm.getUserByEmail.mockResolvedValue(adminUser);
      sm.getUserById.mockResolvedValue(adminUser);
      sm.updateUser.mockResolvedValue({ ...adminUser, password: "hashed:newpass" });
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "admin@test.com", password: "password123" });
      const res = await agent.put("/api/auth/password").send({ currentPassword: "password123", newPassword: "newpass" });
      expect(res.status).toBe(200);
      expect(sm.updateUser).toHaveBeenCalledOnce();
    });

    it("returns 401 when current password is wrong", async () => {
      sm.getUserByEmail.mockResolvedValue(adminUser);
      sm.getUserById.mockResolvedValue(adminUser);
      const agent = request.agent(app);
      await agent.post("/api/auth/login").send({ email: "admin@test.com", password: "password123" });
      const res = await agent.put("/api/auth/password").send({ currentPassword: "wrongpassword", newPassword: "newpass" });
      expect(res.status).toBe(401);
      expect(sm.updateUser).not.toHaveBeenCalled();
    });
  });
});
