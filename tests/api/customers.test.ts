import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

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

// Repository mocks — routes now call repositories directly, not via storage
vi.mock("../../server/modules/customers/customers.repository", () => ({
  customersRepository: {
    getAll:             (...a: any[]) => sm.getAllCustomers(...a),
    getById:            (...a: any[]) => sm.getCustomerById(...a),
    getJobsByCustomer:  (...a: any[]) => sm.getJobsByCustomer(...a),
    create:             (...a: any[]) => sm.createCustomer(...a),
    update:             (...a: any[]) => sm.updateCustomer(...a),
    delete:             (...a: any[]) => sm.deleteCustomer(...a),
  },
}));

vi.mock("../../server/services/customer-address.service", () => ({
  customerAddressService: {
    getByCustomer: (...a: any[]) => sm.getAddressesByCustomer(...a),
    create:        (...a: any[]) => sm.createCustomerAddress(...a),
    update:        (...a: any[]) => sm.updateCustomerAddress(...a),
    delete:        (...a: any[]) => sm.deleteCustomerAddress(...a),
  },
  AddressError: class AddressError extends Error {
    constructor(message: string, public statusCode: number) { super(message); }
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
  class MockIo { on = vi.fn(); to = vi.fn().mockReturnThis(); emit = vi.fn();
    use = vi.fn(); }
  return { Server: MockIo };
});
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async (pwd) => `hashed:${pwd}`),
    compare: vi.fn(async (pwd, hash) => Promise.resolve(hash === `hashed:${pwd}`)),
  },
}));

import { createTestApp } from "../helpers/createTestApp";

const adminUser = { id: 1, email: "admin@test.com", password: "hashed:password123", name: "Admin User", role: "admin", createdAt: new Date("2025-01-01") };
const technicianUser = { id: 3, email: "tech@test.com", password: "hashed:password123", name: "Tech User", role: "technician", createdAt: new Date("2025-01-01") };
const sampleCustomer = { id: 10, name: "Acme Corp", email: "acme@example.com", phone: "555-1234", notes: null, tags: ["vip"], leadSource: "referral", company: "Acme Corp", createdAt: new Date("2025-01-01") };
const sampleAddress = { id: 1, customerId: 10, label: "Main Office", address: "123 Main St", city: "Austin", state: "TX", zip: "78701", isPrimary: true, notes: null, createdAt: new Date("2025-01-01") };

let loginCounter = 0;
async function loginAs(app, user) {
  sm.getUserByEmail.mockResolvedValue(user);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").set("X-Forwarded-For", `10.0.${Math.floor(loginCounter / 254)}.${loginCounter % 254 + 1}`).send({ email: user.email, password: "password123" });
  loginCounter++;
  sm.getUserById.mockResolvedValue(user);
  return agent;
}

describe("Customers API", () => {
  let app;
  beforeAll(async () => { ({ app } = await createTestApp()); });
  beforeEach(() => { Object.values(sm).forEach((fn) => fn.mockReset()); });

  describe("GET /api/customers", () => {
    it("returns 401 when not authenticated", async () => {
      expect((await request(app).get("/api/customers")).status).toBe(401);
    });
    it("returns list of customers", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getAllCustomers.mockResolvedValue([sampleCustomer]);
      const res = await agent.get("/api/customers");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id: 10, name: "Acme Corp" });
    });
    it("returns empty array when no customers", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getAllCustomers.mockResolvedValue([]);
      const res = await agent.get("/api/customers");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/customers/:id", () => {
    it("returns customer by id", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getCustomerById.mockResolvedValue(sampleCustomer);
      sm.getJobsByCustomer.mockResolvedValue([]);
      const res = await agent.get("/api/customers/10");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 10, name: "Acme Corp" });
    });
    it("returns 404 when customer not found", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getCustomerById.mockResolvedValue(undefined);
      expect((await agent.get("/api/customers/999")).status).toBe(404);
    });
  });

  describe("POST /api/customers", () => {
    it("creates a customer and returns 201", async () => {
      const agent = await loginAs(app, adminUser);
      sm.createCustomer.mockResolvedValue(sampleCustomer);
      const res = await agent.post("/api/customers").send({ name: "Acme Corp", email: "acme@example.com" });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 10, name: "Acme Corp" });
      expect(sm.createCustomer).toHaveBeenCalledOnce();
    });
    it("returns 400 when name is missing", async () => {
      const agent = await loginAs(app, adminUser);
      expect((await agent.post("/api/customers").send({ email: "test@test.com" })).status).toBe(400);
    });
  });

  describe("PUT /api/customers/:id", () => {
    it("updates a customer", async () => {
      const agent = await loginAs(app, adminUser);
      sm.updateCustomer.mockResolvedValue({ ...sampleCustomer, name: "Updated" });
      const res = await agent.put("/api/customers/10").send({ name: "Updated" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated");
    });
    it("returns 404 when customer not found", async () => {
      const agent = await loginAs(app, adminUser);
      sm.updateCustomer.mockResolvedValue(undefined);
      expect((await agent.put("/api/customers/999").send({ name: "X" })).status).toBe(404);
    });
  });

  describe("DELETE /api/customers/:id", () => {
    it("admin can delete a customer", async () => {
      const agent = await loginAs(app, adminUser);
      sm.deleteCustomer.mockResolvedValue(undefined);
      const res = await agent.delete("/api/customers/10");
      expect(res.status).toBe(200);
      expect(sm.deleteCustomer).toHaveBeenCalledWith(10);
    });
    it("returns 403 for technician role", async () => {
      const agent = await loginAs(app, technicianUser);
      expect((await agent.delete("/api/customers/10")).status).toBe(403);
    });
  });

  describe("Customer Addresses", () => {
    it("GET /:id/addresses returns addresses", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getAddressesByCustomer.mockResolvedValue([sampleAddress]);
      const res = await agent.get("/api/customers/10/addresses");
      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ label: "Main Office" });
    });
    it("POST /:id/addresses creates address", async () => {
      const agent = await loginAs(app, adminUser);
      sm.createCustomerAddress.mockResolvedValue(sampleAddress);
      const res = await agent.post("/api/customers/10/addresses").send({ label: "Main Office", address: "123 Main St", city: "Austin", state: "TX", zip: "78701", isPrimary: true });
      expect(res.status).toBe(201);
      expect(sm.createCustomerAddress).toHaveBeenCalledWith(expect.objectContaining({ customerId: 10 }));
    });
    it("PUT /:cId/addresses/:id updates address", async () => {
      const agent = await loginAs(app, adminUser);
      sm.updateCustomerAddress.mockResolvedValue({ ...sampleAddress, label: "HQ" });
      const res = await agent.put("/api/customers/10/addresses/1").send({ label: "HQ" });
      expect(res.status).toBe(200);
      expect(res.body.label).toBe("HQ");
    });
    it("DELETE /:cId/addresses/:id deletes address", async () => {
      const agent = await loginAs(app, adminUser);
      sm.deleteCustomerAddress.mockResolvedValue(undefined);
      const res = await agent.delete("/api/customers/10/addresses/1");
      expect(res.status).toBe(200);
      expect(sm.deleteCustomerAddress).toHaveBeenCalledWith(1);
    });
  });
});
