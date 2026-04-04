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

const jobExecMock = vi.hoisted(() => ({
  transition:    vi.fn(),
  adminOverride: vi.fn(),
}));

vi.mock("../../server/index", () => ({ log: vi.fn() }));
vi.mock("../../server/db", () => ({ pool: { query: vi.fn(), end: vi.fn() }, db: {} }));
vi.mock("../../server/storage", () => ({ storage: sm }));

// Repository mocks — job routes call repositories directly, not via storage
vi.mock("../../server/modules/jobs/jobs.repository", () => ({
  jobsRepository: {
    getAll:                       (...a) => sm.getAllJobs(...a),
    getById:                      (...a) => sm.getJobById(...a),
    getByIdWithCustomerSummary:   (...a) => sm.getJobById(...a),
    getByRequestId:               (...a) => sm.getJobByRequestId?.(...a),
    getByCustomer:                (...a) => sm.getJobsByCustomer(...a),
    getByTechnician:              (...a) => sm.getAllJobs(...a),
    getByTechnicianWithCustomer:  (...a) => sm.getJobsByTechnicianWithCustomer(...a),
    create:                       (...a) => sm.createJob(...a),
    update:                       (...a) => sm.updateJob(...a),
    delete:                       (...a) => sm.deleteJob(...a),
    getNextJobNumber:             (...a) => sm.getNextJobNumber(...a),
  },
}));

vi.mock("../../server/modules/jobs/notes/job-notes.repository", () => ({
  jobNotesRepository: {
    getJobNotes:      (...a) => sm.getJobNotes(...a),
    createJobNote:    (...a) => sm.createJobNote(...a),
    markJobNoteRead:  (...a) => sm.markJobNoteRead(...a),
  },
}));

vi.mock("../../server/modules/jobs/materials/job-materials.repository", () => ({
  jobMaterialsRepository: {
    getJobMaterials:    (...a) => sm.getJobMaterials(...a),
    createJobMaterial:  (...a) => sm.createJobMaterial(...a),
    deleteJobMaterial:  (...a) => sm.deleteJobMaterial(...a),
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

vi.mock("../../server/modules/technicians/technicians.repository", () => ({
  techniciansRepository: {
    getAll:        (...a) => sm.getAllTechnicians(...a),
    getById:       (...a) => sm.getTechnicianById(...a),
    getByUserId:   (...a) => sm.getTechnicianByUserId(...a),
    create:        (...a) => sm.createTechnician(...a),
    update:        (...a) => sm.updateTechnician(...a),
    delete:        (...a) => sm.deleteTechnician(...a),
  },
}));

// Service mocks — job-execution.service and notification.service use db.transaction / storage internally
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

vi.mock("../../server/services/notification.service", () => ({
  notificationService: { notifyJobNote: vi.fn(), notifyJobActivity: vi.fn() },
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
const sampleJob = { id: 100, jobNumber: "JOB-00001", title: "Fix HVAC", description: "Replace filter", instructions: null, customerId: 10, technicianId: 1, status: "pending", priority: "normal", invoicingType: "fixed", billingSchedule: "on_completion", scheduledAt: new Date("2026-04-01T09:00:00Z"), estimatedDuration: 60, address: "123 Main St", city: "Austin", state: "TX", zip: "78701", notes: null, completedAt: null, createdAt: new Date("2025-01-01"), updatedAt: new Date("2025-01-01") };
const sampleTechnician = { id: 1, userId: 3, phone: "555-0000", skills: ["hvac"], status: "available", currentLat: null, currentLng: null, color: "#f97316", hourlyRate: "25.00" };

let loginCounter = 0;
async function loginAs(app, user) {
  sm.getUserByEmail.mockResolvedValue(user);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").set("X-Forwarded-For", `10.0.${Math.floor(loginCounter / 254)}.${loginCounter % 254 + 1}`).send({ email: user.email, password: "password123" });
  loginCounter++;
  sm.getUserById.mockResolvedValue(user);
  return agent;
}

describe("Jobs API", () => {
  let app;
  beforeAll(async () => { ({ app } = await createTestApp()); });
  beforeEach(() => {
    Object.values(sm).forEach((fn) => fn.mockReset());
    Object.values(jobExecMock).forEach((fn) => fn.mockReset());
  });

  describe("GET /api/jobs", () => {
    it("returns 401 when not authenticated", async () => {
      expect((await request(app).get("/api/jobs")).status).toBe(401);
    });
    it("returns all jobs", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getAllJobs.mockResolvedValue([sampleJob]);
      const res = await agent.get("/api/jobs");
      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ id: 100, title: "Fix HVAC", status: "pending" });
    });
  });

  describe("GET /api/jobs/:id", () => {
    it("returns job by id", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getJobById.mockResolvedValue(sampleJob);
      sm.getJobNotes.mockResolvedValue([]);
      const res = await agent.get("/api/jobs/100");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 100, title: "Fix HVAC" });
    });
    it("returns 404 for non-existent job", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getJobById.mockResolvedValue(undefined);
      expect((await agent.get("/api/jobs/999")).status).toBe(404);
    });
  });

  describe("POST /api/jobs", () => {
    it("creates job with auto jobNumber", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getNextJobNumber.mockResolvedValue("JOB-00001");
      sm.createJob.mockResolvedValue(sampleJob);
      const res = await agent.post("/api/jobs").send({ title: "Fix HVAC", status: "pending", priority: "normal" });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ id: 100, jobNumber: "JOB-00001" });
      expect(sm.getNextJobNumber).toHaveBeenCalledOnce();
      expect(sm.createJob).toHaveBeenCalledWith(expect.objectContaining({ title: "Fix HVAC", jobNumber: "JOB-00001" }));
    });
    it("returns 400 when title is missing", async () => {
      const agent = await loginAs(app, adminUser);
      expect((await agent.post("/api/jobs").send({ customerId: 10 })).status).toBe(400);
    });
  });

  describe("PUT /api/jobs/:id", () => {
    it("admin can update any field", async () => {
      const agent = await loginAs(app, adminUser);
      sm.updateJob.mockResolvedValue({ ...sampleJob, title: "Fix AC" });
      const res = await agent.put("/api/jobs/100").send({ title: "Fix AC" });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Fix AC");
    });
    it("auto-sets completedAt when status becomes completed", async () => {
      const agent = await loginAs(app, adminUser);
      sm.updateJob.mockImplementation(async (_id, data) => ({ ...sampleJob, ...data, id: 100 }));
      await agent.put("/api/jobs/100").send({ status: "completed" });
      expect(sm.updateJob).toHaveBeenCalledWith(100, expect.objectContaining({ status: "completed", completedAt: expect.any(Date) }));
    });
    it("technician can only update status/notes of their own job", async () => {
      const agent = await loginAs(app, technicianUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);
      sm.getJobById.mockResolvedValue({ ...sampleJob, technicianId: sampleTechnician.id });
      sm.updateJob.mockResolvedValue({ ...sampleJob, status: "in_progress" });
      const res = await agent.put("/api/jobs/100").send({ status: "in_progress", title: "Should be ignored" });
      expect(res.status).toBe(200);
      expect(sm.updateJob).toHaveBeenCalledWith(100, expect.not.objectContaining({ title: expect.anything() }));
    });
    it("technician cannot update a job not assigned to them", async () => {
      const agent = await loginAs(app, technicianUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);
      sm.getJobById.mockResolvedValue({ ...sampleJob, technicianId: 999 });
      expect((await agent.put("/api/jobs/100").send({ status: "in_progress" })).status).toBe(403);
    });
  });

  describe("DELETE /api/jobs/:id", () => {
    it("admin can delete a job", async () => {
      const agent = await loginAs(app, adminUser);
      sm.deleteJob.mockResolvedValue(undefined);
      const res = await agent.delete("/api/jobs/100");
      expect(res.status).toBe(200);
      expect(sm.deleteJob).toHaveBeenCalledWith(100);
    });
    it("technician cannot delete a job", async () => {
      const agent = await loginAs(app, technicianUser);
      expect((await agent.delete("/api/jobs/100")).status).toBe(403);
    });
  });

  describe("PUT /api/jobs/:id/status — state machine", () => {
    it("on_the_way → calls transition and returns job", async () => {
      const agent = await loginAs(app, technicianUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);
      const updatedJob = { ...sampleJob, status: "on_the_way" };
      jobExecMock.transition.mockResolvedValue({ job: updatedJob, timesheetEntries: [{ entryType: "travel_start", jobId: 100 }] });
      const res = await agent.put("/api/jobs/100/status").send({ status: "on_the_way" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 100, status: "on_the_way" });
      expect(jobExecMock.transition).toHaveBeenCalledWith(expect.objectContaining({ jobId: 100, newStatus: "on_the_way" }));
    });
    it("on_the_way → in_progress calls transition", async () => {
      const agent = await loginAs(app, technicianUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);
      const updatedJob = { ...sampleJob, status: "in_progress" };
      jobExecMock.transition.mockResolvedValue({ job: updatedJob, timesheetEntries: [{ entryType: "travel_end" }, { entryType: "work_start" }] });
      const res = await agent.put("/api/jobs/100/status").send({ status: "in_progress" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "in_progress" });
    });
    it("completed → calls transition with completed status", async () => {
      const agent = await loginAs(app, technicianUser);
      sm.getTechnicianByUserId.mockResolvedValue(sampleTechnician);
      const completedJob = { ...sampleJob, status: "completed", completedAt: new Date() };
      jobExecMock.transition.mockResolvedValue({ job: completedJob, timesheetEntries: [{ entryType: "work_end" }] });
      const res = await agent.put("/api/jobs/100/status").send({ status: "completed" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "completed" });
      expect(jobExecMock.transition).toHaveBeenCalledWith(expect.objectContaining({ newStatus: "completed" }));
    });
    it("returns 400 when status is missing", async () => {
      const agent = await loginAs(app, adminUser);
      expect((await agent.put("/api/jobs/100/status").send({})).status).toBe(400);
    });
  });

  describe("Job Notes", () => {
    it("POST /api/jobs/:id/notes creates a note", async () => {
      const agent = await loginAs(app, adminUser);
      sm.createJobNote.mockResolvedValue({ id: 1, jobId: 100, userId: 1, content: "Done", createdAt: new Date() });
      sm.getJobById.mockResolvedValue(sampleJob);
      sm.getTechnicianByUserId.mockResolvedValue(null);
      sm.getAdminAndDispatcherUserIds.mockResolvedValue([1]);
      const res = await agent.post("/api/jobs/100/notes").send({ content: "Done" });
      expect(res.status).toBe(201);
      expect(sm.createJobNote).toHaveBeenCalledWith(expect.objectContaining({ jobId: 100, content: "Done", userId: 1 }));
    });
  });

  describe("Job Materials", () => {
    it("GET /api/jobs/:id/materials returns materials", async () => {
      const agent = await loginAs(app, adminUser);
      sm.getJobMaterials.mockResolvedValue([{ id: 1, jobId: 100, name: "Filter", quantity: "2", unit: "pcs", unitCost: "15.00", notes: null, createdAt: new Date() }]);
      const res = await agent.get("/api/jobs/100/materials");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
    it("POST /api/jobs/:id/materials adds material", async () => {
      const agent = await loginAs(app, adminUser);
      sm.createJobMaterial.mockResolvedValue({ id: 1, jobId: 100, name: "Filter", quantity: "2", unit: "pcs", unitCost: "15.00", notes: null, createdAt: new Date() });
      const res = await agent.post("/api/jobs/100/materials").send({ name: "Filter", quantity: "2", unit: "pcs", unitCost: "15.00" });
      expect(res.status).toBe(201);
      expect(sm.createJobMaterial).toHaveBeenCalledWith(expect.objectContaining({ jobId: 100, name: "Filter" }));
    });
  });
});
