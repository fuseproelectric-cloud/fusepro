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
    getEstimateByRequestId: f(), getJobByRequestId: f(), getTimesheetEntryById: f(),
    getUnreadNotifications: f(), markNotificationRead: f(), createActivityNotification: f(), upsertMessageNotification: f(), getAdminAndDispatcherUserIds: f(),
    getChatMessages: f(), createChatMessage: f(), getChatUnreadCount: f(), markChatRead: f(),
    getConversationsForUser: f(), createConversation: f(), getOrCreateDirectConversation: f(), getConvMessages: f(), createConvMessage: f(),
    markConvRead: f(), updateConversationName: f(), addConvMember: f(), removeConvMember: f(), getConvMembers: f(), getJobChatList: f(), ensureTeamMember: f(),
  };
});

const conversionSvcMock = vi.hoisted(() => ({
  toEstimate: vi.fn(),
  toJob:      vi.fn(),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../server/index",   () => ({ log: vi.fn() }));
vi.mock("../../server/db",      () => ({ pool: { query: vi.fn(), end: vi.fn() }, db: {} }));
vi.mock("../../server/storage", () => ({ storage: sm }));

vi.mock("../../server/services/request-conversion.service", async () => {
  const { AppError } = await import("../../server/core/errors/app-error");
  class ConversionError extends AppError {
    constructor(message: string, statusCode: number) {
      super(message, statusCode, "CONVERSION_ERROR");
      this.name = "ConversionError";
    }
  }
  return { requestConversionService: conversionSvcMock, ConversionError };
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

const sampleRequest = {
  id: 300, title: "Need AC tune-up", customerId: 10, serviceAddressId: 5,
  status: "new", convertedToType: null, convertedAt: null, convertedByUserId: null,
};
const sampleEstimate = {
  id: 50, requestId: 300, customerId: 10, title: "Need AC tune-up",
  status: "draft", lineItems: [], subtotal: "0", tax: "0", total: "0",
};
const sampleJob = {
  id: 60, requestId: 300, customerId: 10, title: "Need AC tune-up",
  jobNumber: "JOB-00001", status: "pending",
};

let loginCounter = 0;
async function loginAs(app, user) {
  sm.getUserByEmail.mockResolvedValue(user);
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .set("X-Forwarded-For", `10.1.${Math.floor(loginCounter / 254)}.${loginCounter % 254 + 1}`)
    .send({ email: user.email, password: "password123" });
  loginCounter++;
  sm.getUserById.mockResolvedValue(user);
  return agent;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Request Conversion API", () => {
  let app;
  beforeAll(async () => { ({ app } = await createTestApp()); });
  beforeEach(() => {
    Object.values(sm).forEach((fn) => fn.mockReset());
    Object.values(conversionSvcMock).forEach((fn) => fn.mockReset());
  });

  // ── Auth protection ─────────────────────────────────────────────────────────

  describe("auth protection", () => {
    it("POST convert-estimate → 401 when unauthenticated", async () => {
      expect((await request(app).post("/api/requests/300/convert-estimate")).status).toBe(401);
    });
    it("POST convert-job → 401 when unauthenticated", async () => {
      expect((await request(app).post("/api/requests/300/convert-job")).status).toBe(401);
    });
    it("POST convert-estimate → 403 for technician", async () => {
      const agent = await loginAs(app, techUser);
      expect((await agent.post("/api/requests/300/convert-estimate")).status).toBe(403);
    });
    it("POST convert-job → 403 for technician", async () => {
      const agent = await loginAs(app, techUser);
      expect((await agent.post("/api/requests/300/convert-job")).status).toBe(403);
    });
  });

  // ── POST convert-estimate ───────────────────────────────────────────────────

  describe("POST /api/requests/:id/convert-estimate", () => {
    it("returns 201 with the created estimate on success", async () => {
      const agent = await loginAs(app, adminUser);
      conversionSvcMock.toEstimate.mockResolvedValue({
        request: { ...sampleRequest, status: "converted" },
        entity:  sampleEstimate,
        entityType: "estimate",
      });

      const res = await agent.post("/api/requests/300/convert-estimate");
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 50, status: "draft", requestId: 300 });
      expect(conversionSvcMock.toEstimate).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 300 }),
      );
    });

    it("returns 409 and CONVERSION_ERROR when request is already converted", async () => {
      const agent = await loginAs(app, adminUser);
      const { ConversionError } = await import("../../server/services/request-conversion.service");
      conversionSvcMock.toEstimate.mockRejectedValue(
        new ConversionError("Request is already converted.", 409),
      );

      const res = await agent.post("/api/requests/300/convert-estimate");
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONVERSION_ERROR");
      expect(res.body.error.message).toMatch(/already converted/i);
    });

    it("returns 422 and CONVERSION_ERROR when request is closed", async () => {
      const agent = await loginAs(app, adminUser);
      const { ConversionError } = await import("../../server/services/request-conversion.service");
      conversionSvcMock.toEstimate.mockRejectedValue(
        new ConversionError("Cannot convert a closed request.", 422),
      );

      const res = await agent.post("/api/requests/300/convert-estimate");
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("CONVERSION_ERROR");
      expect(res.body.error.message).toMatch(/closed/i);
    });

    it("returns 422 when request is archived", async () => {
      const agent = await loginAs(app, adminUser);
      const { ConversionError } = await import("../../server/services/request-conversion.service");
      conversionSvcMock.toEstimate.mockRejectedValue(
        new ConversionError("Cannot convert an archived request.", 422),
      );

      const res = await agent.post("/api/requests/300/convert-estimate");
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("CONVERSION_ERROR");
    });

    it("returns 404 when request does not exist", async () => {
      const agent = await loginAs(app, adminUser);
      const { ConversionError } = await import("../../server/services/request-conversion.service");
      conversionSvcMock.toEstimate.mockRejectedValue(
        new ConversionError("Request not found.", 404),
      );

      const res = await agent.post("/api/requests/999/convert-estimate");
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("CONVERSION_ERROR");
    });
  });

  // ── POST convert-job ────────────────────────────────────────────────────────

  describe("POST /api/requests/:id/convert-job", () => {
    it("returns 201 with the created job on success", async () => {
      const agent = await loginAs(app, adminUser);
      conversionSvcMock.toJob.mockResolvedValue({
        request: { ...sampleRequest, status: "converted" },
        entity:  sampleJob,
        entityType: "job",
      });

      const res = await agent.post("/api/requests/300/convert-job");
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 60, status: "pending", jobNumber: "JOB-00001" });
      expect(conversionSvcMock.toJob).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 300 }),
      );
    });

    it("returns 409 and CONVERSION_ERROR on duplicate conversion attempt", async () => {
      const agent = await loginAs(app, adminUser);
      const { ConversionError } = await import("../../server/services/request-conversion.service");
      conversionSvcMock.toJob.mockRejectedValue(
        new ConversionError("Request is already converted.", 409),
      );

      const res = await agent.post("/api/requests/300/convert-job");
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONVERSION_ERROR");
      expect(res.body.error.message).toMatch(/already converted/i);
    });

    it("returns 422 for closed request", async () => {
      const agent = await loginAs(app, adminUser);
      const { ConversionError } = await import("../../server/services/request-conversion.service");
      conversionSvcMock.toJob.mockRejectedValue(
        new ConversionError("Cannot convert a closed request.", 422),
      );

      const res = await agent.post("/api/requests/300/convert-job");
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("CONVERSION_ERROR");
    });

    it("returns 422 for non-convertible status", async () => {
      const agent = await loginAs(app, adminUser);
      const { ConversionError } = await import("../../server/services/request-conversion.service");
      conversionSvcMock.toJob.mockRejectedValue(
        new ConversionError("Request status 'on_hold' is not eligible for conversion.", 422),
      );

      const res = await agent.post("/api/requests/300/convert-job");
      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/not eligible/i);
    });
  });

  // ── Error response shape ────────────────────────────────────────────────────

  describe("error response shape", () => {
    it("all conversion errors use { error: { code, message } } envelope", async () => {
      const agent = await loginAs(app, adminUser);
      const { ConversionError } = await import("../../server/services/request-conversion.service");
      conversionSvcMock.toEstimate.mockRejectedValue(
        new ConversionError("Request is already converted.", 409),
      );

      const res = await agent.post("/api/requests/300/convert-estimate");
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatchObject({ code: "CONVERSION_ERROR", message: expect.any(String) });
      expect(res.body).not.toHaveProperty("message"); // not the old { message } shape
    });
  });
});
