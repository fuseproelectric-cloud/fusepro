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
    getTimesheetEntryById: f(),
    getUnreadNotifications: f(), markNotificationRead: f(), createActivityNotification: f(), upsertMessageNotification: f(), getAdminAndDispatcherUserIds: f(),
    getChatMessages: f(), createChatMessage: f(), getChatUnreadCount: f(), markChatRead: f(),
    getConversationsForUser: f(), createConversation: f(), getOrCreateDirectConversation: f(), getConvMessages: f(), createConvMessage: f(),
    markConvRead: f(), updateConversationName: f(), addConvMember: f(), removeConvMember: f(), getConvMembers: f(), getJobChatList: f(), ensureTeamMember: f(),
  };
});

const jobExecMock = vi.hoisted(() => ({
  transition:    vi.fn(),
  adminOverride: vi.fn(),
}));

const timesheetSvcMock = vi.hoisted(() => ({
  startDay:   vi.fn(),
  endDay:     vi.fn(),
  startBreak: vi.fn(),
  endBreak:   vi.fn(),
}));

const notifMock = vi.hoisted(() => ({
  notifyJobActivity: vi.fn(),
  notifyDayActivity: vi.fn(),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../server/index",   () => ({ log: vi.fn() }));
vi.mock("../../server/db",      () => ({ pool: { query: vi.fn(), end: vi.fn() }, db: {} }));
vi.mock("../../server/storage", () => ({ storage: sm }));

vi.mock("../../server/services/job-execution.service", async () => {
  const { AppError } = await import("../../server/core/errors/app-error");
  class TransitionError extends AppError {
    constructor(message: string, statusCode: number) {
      super(message, statusCode, "JOB_TRANSITION_ERROR");
      this.name = "TransitionError";
    }
  }
  return { jobExecutionService: jobExecMock, TransitionError };
});

vi.mock("../../server/services/timesheet.service", () => ({
  timesheetService: timesheetSvcMock,
  JOB_LIFECYCLE_ENTRY_TYPES: new Set(["travel_start", "travel_end", "work_start", "work_end"]),
}));

vi.mock("../../server/services/notification.service", () => ({
  notificationService: notifMock,
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
    hash:    vi.fn(async (pwd)        => `hashed:${pwd}`),
    compare: vi.fn(async (pwd, hash)  => hash === `hashed:${pwd}`),
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
const sampleTechnician = {
  id: 1, userId: 3, phone: "555-0000", skills: ["hvac"],
  status: "available", currentLat: null, currentLng: null,
  color: "#f97316", hourlyRate: "25.00",
};
const sampleEntry = {
  id: 42, technicianId: 1, jobId: null, entryType: "day_start",
  timestamp: new Date("2026-04-01T08:00:00Z"), notes: null,
};
const approvedEntry = {
  id: 99, technicianId: 1, jobId: 100, entryType: "work_start",
  timestamp: new Date("2026-04-01T10:00:00Z"), notes: null,
};
const sampleJob = {
  id: 100, jobNumber: "JOB-00001", title: "Fix HVAC", status: "assigned",
  technicianId: sampleTechnician.id, customerId: 10,
};

let loginCounter = 0;
async function loginAs(app, user) {
  sm.getUserByEmail.mockResolvedValue(user);
  const agent = request.agent(app);
  await agent
    .post("/api/auth/login")
    .set("X-Forwarded-For", `10.0.${Math.floor(loginCounter / 254)}.${loginCounter % 254 + 1}`)
    .send({ email: user.email, password: "password123" });
  loginCounter++;
  sm.getUserById.mockResolvedValue(user);
  return agent;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Timesheets API", () => {
  let app;
  beforeAll(async () => { ({ app } = await createTestApp()); });
  beforeEach(() => {
    Object.values(sm).forEach((fn) => fn.mockReset());
    Object.values(jobExecMock).forEach((fn) => fn.mockReset());
    Object.values(timesheetSvcMock).forEach((fn) => fn.mockReset());
    Object.values(notifMock).forEach((fn) => fn.mockReset());
  });

  // ── 1. Auth / access protection ─────────────────────────────────────────────

  describe("auth protection", () => {
    it("GET /api/timesheet/today → 401 when not authenticated", async () => {
      const res = await request(app).get("/api/timesheet/today");
      expect(res.status).toBe(401);
    });

    it("GET /api/timesheet/week → 401 when not authenticated", async () => {
      const res = await request(app).get("/api/timesheet/week");
      expect(res.status).toBe(401);
    });

    it("POST /api/timesheet → 401 when not authenticated", async () => {
      const res = await request(app).post("/api/timesheet").send({ entryType: "day_start" });
      expect(res.status).toBe(401);
    });

    it("PUT /api/jobs/:id/status → 401 when not authenticated", async () => {
      const res = await request(app).put("/api/jobs/100/status").send({ status: "on_the_way" });
      expect(res.status).toBe(401);
    });

    it("GET /api/admin/timesheets → 401 when not authenticated", async () => {
      const res = await request(app).get("/api/admin/timesheets");
      expect(res.status).toBe(401);
    });

    it("GET /api/admin/timesheets → 403 when technician", async () => {
      const agent = await loginAs(app, techUser);
      const res = await agent.get("/api/admin/timesheets");
      expect(res.status).toBe(403);
    });
  });

  // ── 2. Technician timesheet flow ─────────────────────────────────────────────

  describe("GET /api/timesheet/today", () => {
    it("returns entries and status for authenticated technician", async () => {
      const agent = await loginAs(app, techUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);
      sm.getTodayTimesheets.mockResolvedValue([sampleEntry]);
      sm.getTechnicianCurrentStatus.mockResolvedValue({ isDayStarted: true, activeJobId: null });

      const res = await agent.get("/api/timesheet/today");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("entries");
      expect(res.body).toHaveProperty("status");
      expect(res.body.entries).toHaveLength(1);
    });

    it("returns 404 when no technician profile found", async () => {
      const agent = await loginAs(app, techUser);
      sm.getTechnicianByUserId.mockResolvedValue(null);

      const res = await agent.get("/api/timesheet/today");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/timesheet", () => {
    it("rejects job-lifecycle entry types with 400 and VALIDATION_ERROR code", async () => {
      const agent = await loginAs(app, techUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);

      const res = await agent.post("/api/timesheet").send({ entryType: "travel_start" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.message).toMatch(/job lifecycle/i);
    });

    it("accepts day_start and returns 201", async () => {
      const agent = await loginAs(app, techUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);
      timesheetSvcMock.startDay.mockResolvedValue(sampleEntry);
      notifMock.notifyDayActivity.mockResolvedValue(undefined);

      const res = await agent.post("/api/timesheet").send({ entryType: "day_start" });
      expect(res.status).toBe(201);
      expect(timesheetSvcMock.startDay).toHaveBeenCalledWith(
        expect.objectContaining({ entryType: "day_start", technicianId: sampleTechnician.id }),
      );
    });

    it("rejects unknown entry type with 400", async () => {
      const agent = await loginAs(app, techUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);

      const res = await agent.post("/api/timesheet").send({ entryType: "unknown_type" });
      expect(res.status).toBe(400);
    });
  });

  // ── 3. Approved day protection ───────────────────────────────────────────────

  describe("approved day protection", () => {
    it("PUT /api/admin/timesheets/entries/:id → 409 CONFLICT when day is approved", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getTimesheetEntryById.mockResolvedValue(approvedEntry);
      sm.getTimesheetApprovals.mockResolvedValue({ "2026-04-01": true });

      const res = await agent
        .put("/api/admin/timesheets/entries/99")
        .send({ entryType: "work_end" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    it("DELETE /api/admin/timesheets/entries/:id → 409 CONFLICT when day is approved", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getTimesheetEntryById.mockResolvedValue(approvedEntry);
      sm.getTimesheetApprovals.mockResolvedValue({ "2026-04-01": true });

      const res = await agent.delete("/api/admin/timesheets/entries/99");

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });

    it("PUT /api/admin/timesheets/entries/:id → 200 when day is not approved", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getTimesheetEntryById.mockResolvedValue(approvedEntry);
      sm.getTimesheetApprovals.mockResolvedValue({ "2026-04-01": false });
      sm.updateTimesheetEntry.mockResolvedValue({ ...approvedEntry, entryType: "work_end" });

      const res = await agent
        .put("/api/admin/timesheets/entries/99")
        .send({ entryType: "work_end" });

      expect(res.status).toBe(200);
    });
  });

  // ── 4. Job status transition flow ────────────────────────────────────────────

  describe("PUT /api/jobs/:id/status", () => {
    it("returns 400 and VALIDATION_ERROR when status is missing", async () => {
      const agent = await loginAs(app, adminUser);

      const res = await agent.put("/api/jobs/100/status").send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("calls adminOverride for admin and returns 200", async () => {
      const agent = await loginAs(app, adminUser);
      jobExecMock.adminOverride.mockResolvedValue({ job: { ...sampleJob, status: "in_progress" }, timesheetEntries: [] });

      const res = await agent.put("/api/jobs/100/status").send({ status: "in_progress" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("in_progress");
      expect(jobExecMock.adminOverride).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 100, newStatus: "in_progress" }),
      );
    });

    it("calls transition for technician and returns 200", async () => {
      const agent = await loginAs(app, techUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);
      jobExecMock.transition.mockResolvedValue({ job: { ...sampleJob, status: "on_the_way" }, timesheetEntries: [] });

      const res = await agent.put("/api/jobs/100/status").send({ status: "on_the_way" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("on_the_way");
      expect(jobExecMock.transition).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: 100, newStatus: "on_the_way", technicianId: sampleTechnician.id }),
      );
    });

    it("propagates TransitionError from service → correct HTTP status and error shape", async () => {
      const agent = await loginAs(app, techUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);

      const { TransitionError } = await import("../../server/services/job-execution.service");
      jobExecMock.transition.mockRejectedValue(
        new TransitionError("Start your day before beginning travel to a job.", 422),
      );

      const res = await agent.put("/api/jobs/100/status").send({ status: "on_the_way" });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("JOB_TRANSITION_ERROR");
      expect(res.body.error.message).toMatch(/start your day/i);
    });
  });

  // ── 5. Error response shape ───────────────────────────────────────────────────

  describe("error response shape", () => {
    it("all error responses use { error: { code, message } } envelope", async () => {
      // 401 from requireAuth uses its own direct shape, not the error middleware
      const unauth = await request(app).get("/api/timesheet/today");
      expect(unauth.body).toHaveProperty("message"); // requireAuth returns { message }

      // 400 from route validation goes through error middleware
      const agent = await loginAs(app, techUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);
      const bad = await agent.post("/api/timesheet").send({ entryType: "work_start" });
      expect(bad.status).toBe(400);
      expect(bad.body).toHaveProperty("error");
      expect(bad.body.error).toHaveProperty("code");
      expect(bad.body.error).toHaveProperty("message");
    });
  });
});
