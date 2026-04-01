import express from "express";
import type { Express } from "express";
import type { Server } from "http";
import { Server as SocketServer } from "socket.io";
import { createSocketServer } from "./core/realtime/socket";
import { authRouter } from "./modules/auth/auth.routes";
import { settingsRouter } from "./modules/settings/settings.routes";
import { connecteamRouter } from "./modules/integrations/connecteam/connecteam.routes";
import { inventoryRouter } from "./modules/inventory/inventory.routes";
import { catalogRouter } from "./modules/catalog/catalog.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { usersRouter } from "./modules/users/users.routes";
import { techniciansRouter } from "./modules/technicians/technicians.routes";
import { customersRouter } from "./modules/customers/customers.routes";
import { addressesRouter } from "./modules/customers/addresses/addresses.routes";
import { requestsRouter } from "./modules/requests/requests.routes";
import { requestConversionRouter } from "./modules/requests/request-conversion.routes";
import { estimatesRouter } from "./modules/estimates/estimates.routes";
import { estimateConversionRouter } from "./modules/estimates/estimate-conversion.routes";
import { invoicesRouter } from "./modules/invoices/invoices.routes";
import { conversationsRouter } from "./modules/conversations/conversations.routes";
import { jobNotesRouter } from "./modules/jobs/notes/job-notes.routes";
import { jobMaterialsRouter } from "./modules/jobs/materials/job-materials.routes";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import { weekBoundsCT, dayBoundsCT, todayStrCT } from "./lib/time";
import { log } from "./core/utils/logger";
import { parseId } from "./core/utils/parse-id";
import { checkLoginRateLimit } from "./core/middleware/rate-limit.middleware";
import { UPLOADS_DIR, upload } from "./core/middleware/upload.middleware";
import { requireAuth, requireRole, requireJobAccess } from "./core/middleware/auth.middleware";
import {
  insertUserSchema,
  insertJobSchema,
  insertTimesheetSchema,
} from "@shared/schema";
import { z } from "zod";
import {
  jobExecutionService,
  TransitionError,
} from "./services/job-execution.service";
import {
  timesheetService,
  TimesheetValidationError,
  JOB_LIFECYCLE_ENTRY_TYPES,
} from "./services/timesheet.service";
import {
  lifecycleService,
  LifecycleError,
} from "./services/lifecycle.service";
import { notificationService } from "./services/notification.service";

// ─── Session setup ───────────────────────────────────────────────────────────
const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// ─── Register all routes ──────────────────────────────────────────────────────
export async function registerRoutes(httpServer: Server, app: Express) {
  // Serve uploaded files
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Upload photos endpoint
  app.post("/api/upload", requireAuth, upload.array("photos", 10), (req, res) => {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return res.status(400).json({ message: "No files uploaded" });
    const urls = files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
  });

  // Session middleware — extracted so it can be shared with Socket.IO
  //
  // SESSION_SECRET must be set via environment variable in production.
  // Starting with a known fallback would allow anyone who has read the source
  // to forge session cookies and authenticate as any user.
  const DEV_ONLY_FALLBACK_SECRET = "dev-only-insecure-fallback-do-not-use-in-production";
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET environment variable is not set. " +
      "Refusing to start in production without a secret. " +
      "Set SESSION_SECRET to a long random string before deploying.",
    );
  }
  const sessionMiddleware = session({
    store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || DEV_ONLY_FALLBACK_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax",
    },
  });
  app.use(sessionMiddleware);

  const io = createSocketServer(httpServer, app, sessionMiddleware);

  app.use(authRouter);
  app.use(settingsRouter);
  app.use(connecteamRouter);
  app.use(inventoryRouter);
  app.use(catalogRouter);
  app.use(notificationsRouter);
  app.use(dashboardRouter);
  app.use(usersRouter);
  app.use(techniciansRouter);
  app.use(customersRouter);
  app.use(addressesRouter);
  app.use(requestsRouter);
  app.use(requestConversionRouter);
  app.use(estimatesRouter);
  app.use(estimateConversionRouter);
  app.use(invoicesRouter);
  app.use(conversationsRouter);
  app.use(jobNotesRouter);
  app.use(jobMaterialsRouter);

  // ─── Technician-specific routes ──────────────────────────────────────────────
  app.get("/api/jobs/my", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const tech = await storage.getTechnicianByUserId(user.id);
      if (!tech) return res.status(404).json({ message: "No technician profile found" });
      const myJobs = await storage.getJobsByTechnicianWithCustomer(tech.id);
      res.json(myJobs);
    } catch (err) {
      res.status(500).json({ message: "Failed to load jobs" });
    }
  });

  // ─── Jobs ────────────────────────────────────────────────────────────────────
  app.get("/api/jobs", requireAuth, async (_req, res) => {
    try {
      const data = await storage.getAllJobs();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Failed to load jobs" });
    }
  });

  app.get("/api/jobs/:id", requireAuth, requireJobAccess, async (req, res) => {
    try {
      const job = await storage.getJobByIdWithCustomerSummary(parseId(req.params.id));
      if (!job) return res.status(404).json({ message: "Job not found" });
      const notes = await storage.getJobNotes(job.id);
      res.json({ ...job, notes });
    } catch (err) {
      res.status(500).json({ message: "Failed to load job" });
    }
  });

  app.post("/api/jobs", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertJobSchema.parse(req.body);
      const jobNumber = await storage.getNextJobNumber();
      const job = await storage.createJob({ ...data, jobNumber });
      const io: SocketServer = (req.app as any).io;
      io?.to("staff:notifications").emit("job:created", job);
      res.status(201).json(job);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  app.put("/api/jobs/:id", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      if (user.role === "technician") {
        // Technicians can only update status and notes on their own jobs
        const tech = await storage.getTechnicianByUserId(user.id);
        if (!tech) return res.status(403).json({ message: "Forbidden" });
        const job = await storage.getJobById(parseId(req.params.id));
        if (!job) return res.status(404).json({ message: "Job not found" });
        if (job.technicianId !== tech.id) return res.status(403).json({ message: "Forbidden" });
        const { status, notes } = req.body;
        const allowedData: any = {};
        if (status !== undefined) allowedData.status = status;
        if (notes !== undefined) allowedData.notes = notes;
        if (allowedData.status === "completed" && !allowedData.completedAt) {
          allowedData.completedAt = new Date();
        }
        const updated = await storage.updateJob(parseId(req.params.id), allowedData);
        if (!updated) return res.status(404).json({ message: "Job not found" });
        const io: SocketServer = (req.app as any).io;
        io?.to("staff:notifications").emit("job:updated", updated);
        io?.to(`job:${updated.id}`).emit("job:updated", updated);
        return res.json(updated);
      }

      const data = insertJobSchema.partial().parse(req.body);
      if (data.status === "completed" && !data.completedAt) {
        (data as any).completedAt = new Date();
      }
      const job = await storage.updateJob(parseId(req.params.id), data);
      if (!job) return res.status(404).json({ message: "Job not found" });
      const io: SocketServer = (req.app as any).io;
      io?.to("staff:notifications").emit("job:updated", job);
      io?.to(`job:${job.id}`).emit("job:updated", job);
      res.json(job);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  app.delete("/api/jobs/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      await storage.deleteJob(parseId(req.params.id));
      res.json({ message: "Job deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete job" });
    }
  });

  app.get("/api/jobs/:id/timesheet", requireAuth, requireJobAccess, async (req, res) => {
    try {
      const entries = await storage.getTimesheetEntriesByJob(parseId(req.params.id));
      res.json(entries);
    } catch (err) {
      res.status(500).json({ message: "Failed to load timesheet entries" });
    }
  });

  // ─── Timesheet routes ────────────────────────────────────────────────────────
  app.get("/api/timesheet/today", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const tech = await storage.getTechnicianByUserId(user.id);
      if (!tech) return res.status(404).json({ message: "No technician profile found" });
      const entries = await storage.getTodayTimesheets(tech.id);
      const status = await storage.getTechnicianCurrentStatus(tech.id);
      res.json({ entries, status });
    } catch (err) {
      console.error("Timesheet today error:", err);
      res.status(500).json({ message: "Failed to load today's timesheet" });
    }
  });

  app.get("/api/timesheet/week", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const tech = await storage.getTechnicianByUserId(user.id);
      if (!tech) return res.status(404).json({ message: "No technician profile found" });
      const weekOfParam = req.query.weekOf as string | undefined;
      const allEntries = await storage.getWeekTimesheets(tech.id, weekOfParam);

      // Group by day (Mon–Sun) in Chicago time
      const { dayStrings } = weekBoundsCT(weekOfParam);
      const todayStr = todayStrCT();
      const now = new Date();

      const days = [];
      let totalWorkMinutes = 0;
      let totalTravelMinutes = 0;

      for (const dayStr of dayStrings) {
        const { start: dayStart, end: dayEnd } = dayBoundsCT(dayStr);
        const dayEntries = allEntries.filter((e) => {
          const t = new Date(e.timestamp);
          return t >= dayStart && t < dayEnd;
        });

        let workMinutes = 0;
        let travelMinutes = 0;
        let openWorkStart: Date | null = null;
        let openTravelStart: Date | null = null;
        const sorted = [...dayEntries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const isToday = dayStr === todayStr;
        const dayEndTime = isToday ? now : dayEnd;

        for (const entry of sorted) {
          if (entry.entryType === "work_start") openWorkStart = new Date(entry.timestamp);
          else if (entry.entryType === "work_end" && openWorkStart) {
            workMinutes += Math.floor((new Date(entry.timestamp).getTime() - openWorkStart.getTime()) / 60000);
            openWorkStart = null;
          }
          if (entry.entryType === "travel_start") openTravelStart = new Date(entry.timestamp);
          else if (entry.entryType === "travel_end" && openTravelStart) {
            travelMinutes += Math.floor((new Date(entry.timestamp).getTime() - openTravelStart.getTime()) / 60000);
            openTravelStart = null;
          }
        }
        if (openWorkStart) workMinutes += Math.floor((dayEndTime.getTime() - openWorkStart.getTime()) / 60000);
        if (openTravelStart) travelMinutes += Math.floor((dayEndTime.getTime() - openTravelStart.getTime()) / 60000);

        const jobIds = new Set(dayEntries.filter((e) => e.jobId).map((e) => e.jobId));
        totalWorkMinutes += workMinutes;
        totalTravelMinutes += travelMinutes;

        days.push({
          date: dayStr,
          entries: dayEntries,
          workMinutes,
          travelMinutes,
          jobsCount: jobIds.size,
        });
      }

      const approvals = await storage.getTimesheetApprovals(tech.id, dayStrings);
      res.json({ days, totalWorkMinutes, totalTravelMinutes, approvals });
    } catch (err) {
      console.error("Timesheet week error:", err);
      res.status(500).json({ message: "Failed to load week timesheet" });
    }
  });

  // ─── Timesheet: day-lifecycle and breaks only ────────────────────────────────
  // Job-lifecycle entries (travel_start/end, work_start/end) are owned by
  // PUT /api/jobs/:id/status via JobExecutionService. Submitting them here
  // returns HTTP 400 with a clear error directing the client to the correct endpoint.
  app.post("/api/timesheet", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const tech = await storage.getTechnicianByUserId(user.id);
      if (!tech) return res.status(404).json({ message: "No technician profile found" });

      const { entryType } = req.body;

      // Reject job-lifecycle entry types — these belong to the job status flow
      if (JOB_LIFECYCLE_ENTRY_TYPES.has(entryType)) {
        return res.status(400).json({
          message:
            `'${entryType}' is a job lifecycle entry and is managed automatically via ` +
            `PUT /api/jobs/:id/status. Do not submit it here.`,
        });
      }

      // Validate and parse the request body.
      // Force technicianId from session and strip any client-provided timestamp —
      // the service always overwrites timestamp with new Date() server-side.
      const { timestamp: _ignored, ...bodyWithoutTimestamp } = req.body;
      const data = insertTimesheetSchema.parse({ ...bodyWithoutTimestamp, technicianId: tech.id });

      // Dispatch to the appropriate TimesheetService method
      let entry;
      try {
        switch (data.entryType) {
          case "day_start":   entry = await timesheetService.startDay(data);   break;
          case "day_end":     entry = await timesheetService.endDay(data);     break;
          case "break_start": entry = await timesheetService.startBreak(data); break;
          case "break_end":   entry = await timesheetService.endBreak(data);   break;
          default:
            return res.status(400).json({ message: `Unknown entry type: ${data.entryType}` });
        }
      } catch (err) {
        if (err instanceof TimesheetValidationError) {
          return res.status(err.statusCode).json({ message: err.message });
        }
        throw err;
      }

      // Delegate all notification creation (DB persistence + realtime) to service
      const io: SocketServer = (req.app as any).io;
      await notificationService.notifyDayActivity({
        entryType: data.entryType,
        user,
        timestamp: entry.timestamp,
        notes:     data.notes ?? null,
        io,
      });

      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      console.error("Timesheet create error:", err);
      res.status(500).json({ message: "Failed to create timesheet entry" });
    }
  });

  // ─── Admin Timesheet (all technicians) ───────────────────────────────────────
  app.get("/api/admin/timesheets", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const dateParam = (req.query.date as string | undefined) ?? todayStrCT();
      // Validate format YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return res.status(400).json({ message: "Invalid date" });
      const data = await storage.getAllTimesheetsByDate(dateParam);
      res.json(data);
    } catch (err) {
      console.error("Admin timesheets error:", err);
      res.status(500).json({ message: "Failed to load timesheets" });
    }
  });

  app.get("/api/timesheet/earnings", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const tech = await storage.getTechnicianByUserId(user.id);
      if (!tech) return res.status(404).json({ message: "No technician profile" });
      const from = (req.query.from as string) ?? todayStrCT();
      const to = (req.query.to as string) ?? todayStrCT();
      const data = await storage.getTechnicianEarnings(tech.id, from, to);
      res.json(data);
    } catch (err) {
      console.error("Earnings error:", err);
      res.status(500).json({ message: "Failed to load earnings" });
    }
  });

  app.get("/api/admin/timesheets/report", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return res.status(400).json({ message: "Invalid from/to date" });
      }
      const data = await storage.getAllTimesheetsByRange(from, to);
      res.json(data);
    } catch (err) {
      console.error("Timesheets report error:", err);
      res.status(500).json({ message: "Failed to load report" });
    }
  });

  // ─── Admin: week view for a specific technician ──────────────────────────────
  app.get("/api/admin/timesheets/week/:techId", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const techId = parseId(req.params.techId);
      const weekOfParam = req.query.weekOf as string | undefined;
      const allEntries = await storage.getWeekTimesheets(techId, weekOfParam);
      const { dayStrings } = weekBoundsCT(weekOfParam);
      const now = new Date();

      const days = dayStrings.map((date) => {
        const { start: dayStart, end: dayEnd } = dayBoundsCT(date);
        const dayEntries = allEntries.filter((e) => {
          const t = new Date(e.timestamp);
          return t >= dayStart && t < dayEnd;
        });
        const sorted = [...dayEntries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        let workMinutes = 0, travelMinutes = 0;
        let openWork: Date | null = null, openTravel: Date | null = null;
        const isFuture = dayStart > now;
        const capTime = date === todayStrCT() ? now : dayEnd;
        const jobIds = new Set<number>();
        for (const e of sorted) {
          if (e.jobId) jobIds.add(e.jobId);
          if (e.entryType === "work_start") openWork = new Date(e.timestamp);
          else if (e.entryType === "work_end" && openWork) { workMinutes += Math.floor((new Date(e.timestamp).getTime() - openWork.getTime()) / 60000); openWork = null; }
          if (e.entryType === "travel_start") openTravel = new Date(e.timestamp);
          else if (e.entryType === "travel_end" && openTravel) { travelMinutes += Math.floor((new Date(e.timestamp).getTime() - openTravel.getTime()) / 60000); openTravel = null; }
        }
        if (openWork && !isFuture) workMinutes += Math.floor((capTime.getTime() - openWork.getTime()) / 60000);
        if (openTravel && !isFuture) travelMinutes += Math.floor((capTime.getTime() - openTravel.getTime()) / 60000);
        return { date, entries: sorted, workMinutes, travelMinutes, jobsCount: jobIds.size };
      });

      const approvals = await storage.getTimesheetApprovals(techId, dayStrings);
      const totalWorkMinutes = days.reduce((s, d) => s + d.workMinutes, 0);
      const totalTravelMinutes = days.reduce((s, d) => s + d.travelMinutes, 0);
      res.json({ days, totalWorkMinutes, totalTravelMinutes, approvals });
    } catch (err) {
      console.error("Admin week timesheets error:", err);
      res.status(500).json({ message: "Failed to load week timesheets" });
    }
  });

  // ─── Admin: edit / delete individual timesheet entry ─────────────────────────
  app.put("/api/admin/timesheets/entries/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getTimesheetEntryById(id);
      if (!existing) return res.status(404).json({ message: "Entry not found" });
      // Block edits on approved days — use unapprove endpoint first
      const dateStr = new Date(existing.timestamp).toISOString().slice(0, 10);
      const approvals = await storage.getTimesheetApprovals(existing.technicianId, [dateStr]);
      if (approvals[dateStr]) {
        return res.status(409).json({
          message: "This day is approved. Unapprove it before editing entries.",
        });
      }
      const { entryType, timestamp, notes } = req.body;
      const update: any = {};
      if (entryType !== undefined) update.entryType = entryType;
      if (timestamp !== undefined) update.timestamp = new Date(timestamp);
      if (notes !== undefined) update.notes = notes ?? null;
      const entry = await storage.updateTimesheetEntry(id, update);
      if (!entry) return res.status(404).json({ message: "Entry not found" });
      res.json(entry);
    } catch (err) {
      console.error("Update timesheet entry error:", err);
      res.status(500).json({ message: "Failed to update entry" });
    }
  });

  app.delete("/api/admin/timesheets/entries/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getTimesheetEntryById(id);
      if (!existing) return res.status(404).json({ message: "Entry not found" });
      // Block deletes on approved days — use unapprove endpoint first
      const dateStr = new Date(existing.timestamp).toISOString().slice(0, 10);
      const approvals = await storage.getTimesheetApprovals(existing.technicianId, [dateStr]);
      if (approvals[dateStr]) {
        return res.status(409).json({
          message: "This day is approved. Unapprove it before deleting entries.",
        });
      }
      await storage.deleteTimesheetEntry(id);
      res.json({ ok: true });
    } catch (err) {
      console.error("Delete timesheet entry error:", err);
      res.status(500).json({ message: "Failed to delete entry" });
    }
  });

  // ─── Admin: approve / unapprove a day ────────────────────────────────────────
  app.post("/api/admin/timesheets/approve", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const { technicianId, date } = req.body;
      if (!technicianId || !date) return res.status(400).json({ message: "technicianId and date required" });
      await storage.approveTimesheetDay(Number(technicianId), date, req.session.userId!);
      res.json({ ok: true });
    } catch (err) {
      console.error("Approve timesheet error:", err);
      res.status(500).json({ message: "Failed to approve" });
    }
  });

  app.delete("/api/admin/timesheets/approve", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const { technicianId, date } = req.body;
      if (!technicianId || !date) return res.status(400).json({ message: "technicianId and date required" });
      await storage.unapproveTimesheetDay(Number(technicianId), date);
      res.json({ ok: true });
    } catch (err) {
      console.error("Unapprove timesheet error:", err);
      res.status(500).json({ message: "Failed to unapprove" });
    }
  });

  // ─── Job status update ───────────────────────────────────────────────────────
  // Thin handler — all orchestration is owned by JobExecutionService.
  // Technician path: validates state machine + invariants + writes atomically.
  // Admin/dispatcher path: status override with no timesheet side effects.
  app.put("/api/jobs/:id/status", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const jobId = parseId(req.params.id);
      if (!jobId) return res.status(400).json({ message: "Invalid job id" });

      const { status, notes, lat, lng, address } = req.body;
      if (!status) return res.status(400).json({ message: "status is required" });

      const io: SocketServer = (req.app as any).io;
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const gps = (lat != null && lng != null && Number.isFinite(latNum) && Number.isFinite(lngNum))
        ? { lat: latNum, lng: lngNum, address: address ?? null }
        : undefined;

      if (user.role === "technician") {
        const tech = await storage.getTechnicianByUserId(user.id);
        if (!tech) return res.status(403).json({ message: "Forbidden" });

        const result = await jobExecutionService.transition({
          userId: user.id,
          userName: user.name,
          technicianId: tech.id,
          jobId,
          newStatus: status,
          notes,
          gps,
          io,
        });
        return res.json(result.job);
      }

      // Admin / dispatcher — override path, no timesheet side effects
      const result = await jobExecutionService.adminOverride({ jobId, newStatus: status, notes, io });
      return res.json(result.job);
    } catch (err) {
      if (err instanceof TransitionError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      console.error("Job status update error:", err);
      return res.status(500).json({ message: "Failed to update job status" });
    }
  });

  // ─── Job Materials routes ─────────────────────────────────────────────────────
}
