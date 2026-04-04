import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { Server as SocketServer } from "socket.io";
import { insertJobSchema } from "@shared/schema";
import { requireAuth, requireRole, requireJobAccess } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { jobsRepository } from "./jobs.repository";
import { jobNotesRepository } from "./notes/job-notes.repository";
import { usersRepository } from "../users/users.repository";
import { techniciansRepository } from "../technicians/technicians.repository";
import { storage } from "../../storage"; // for getTimesheetEntriesByJob (not yet extracted)
import { ValidationError, NotFoundError } from "../../core/errors/app-error";
import { auditLog } from "../../core/audit/audit.service";

// Fields a technician is permitted to update on their own jobs.
const technicianJobUpdateSchema = z.object({
  status: z.string().optional(),
  notes: z.string().optional(),
});

export const jobsRouter = Router();

// ─── Technician-specific routes ───────────────────────────────────────────────
// /jobs/my must be registered before /jobs/:id to avoid "my" being parsed as an ID
jobsRouter.get("/api/jobs/my", requireAuth, async (req, res) => {
  try {
    const user = await usersRepository.getById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const tech = await techniciansRepository.getByUserId(user.id);
    if (!tech) return res.status(404).json({ message: "No technician profile found" });
    const myJobs = await jobsRepository.getByTechnicianWithCustomer(tech.id);
    res.json(myJobs);
  } catch (err) {
    res.status(500).json({ message: "Failed to load jobs" });
  }
});

// ─── Jobs ─────────────────────────────────────────────────────────────────────

jobsRouter.get("/api/jobs", requireAuth, async (_req, res) => {
  try {
    const data = await jobsRepository.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to load jobs" });
  }
});

jobsRouter.get("/api/jobs/:id", requireAuth, requireJobAccess, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid job id" });
    const job = await jobsRepository.getByIdWithCustomerSummary(id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    const notes = await jobNotesRepository.getJobNotes(job.id);
    res.json({ ...job, notes });
  } catch (err) {
    res.status(500).json({ message: "Failed to load job" });
  }
});

jobsRouter.post("/api/jobs", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = insertJobSchema.parse(req.body);
    const jobNumber = await jobsRepository.getNextJobNumber();
    const job = await jobsRepository.create({ ...data, jobNumber });
    const io: SocketServer = (req.app as any).io;
    io?.to("staff:notifications").emit("job:created", job);
    auditLog.record({
      requestId:         req.requestId,
      performedByUserId: req.session.userId,
      action:            "job.created",
      entityType:        "job",
      entityId:          job.id,
      metadata:          { jobNumber: job.jobNumber, status: job.status },
    });
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

jobsRouter.put("/api/jobs/:id", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return next(new ValidationError("Invalid job id"));
    const user = await usersRepository.getById(req.session.userId!);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (user.role === "technician") {
      // Technicians can only update status and notes on their own jobs
      const tech = await techniciansRepository.getByUserId(user.id);
      if (!tech) return res.status(403).json({ message: "Forbidden" });
      const job = await jobsRepository.getById(id);
      if (!job) return next(new NotFoundError("Job not found"));
      if (job.technicianId !== tech.id) return res.status(403).json({ message: "Forbidden" });
      const parsed = technicianJobUpdateSchema.parse(req.body);
      const allowedData: Record<string, unknown> = {};
      if (parsed.status !== undefined) allowedData.status = parsed.status;
      if (parsed.notes !== undefined) allowedData.notes = parsed.notes;
      if (allowedData.status === "completed" && !allowedData.completedAt) {
        allowedData.completedAt = new Date();
      }
      const updated = await jobsRepository.update(id, allowedData);
      if (!updated) return next(new NotFoundError("Job not found"));
      const io: SocketServer = (req.app as any).io;
      io?.to("staff:notifications").emit("job:updated", updated);
      io?.to(`job:${updated.id}`).emit("job:updated", updated);
      auditLog.record({
        requestId:         req.requestId,
        performedByUserId: req.session.userId,
        action:            "job.updated",
        entityType:        "job",
        entityId:          id,
      });
      return res.json(updated);
    }

    const data = insertJobSchema.partial().parse(req.body);
    if (data.status === "completed" && !data.completedAt) {
      (data as any).completedAt = new Date();
    }
    const job = await jobsRepository.update(id, data);
    if (!job) return next(new NotFoundError("Job not found"));
    const io: SocketServer = (req.app as any).io;
    io?.to("staff:notifications").emit("job:updated", job);
    io?.to(`job:${job.id}`).emit("job:updated", job);
    auditLog.record({
      requestId:         req.requestId,
      performedByUserId: req.session.userId,
      action:            "job.updated",
      entityType:        "job",
      entityId:          id,
    });
    res.json(job);
  } catch (err) {
    next(err);
  }
});

jobsRouter.delete("/api/jobs/:id", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return next(new ValidationError("Invalid job id"));
    await jobsRepository.delete(id);
    auditLog.record({
      requestId:         req.requestId,
      performedByUserId: req.session.userId,
      action:            "job.deleted",
      entityType:        "job",
      entityId:          id,
    });
    res.json({ message: "Job deleted" });
  } catch (err) {
    next(err);
  }
});

// /jobs/:id/timesheet must be registered before it would conflict — but since it has
// a fixed sub-path "timesheet" this is fine after /:id
jobsRouter.get("/api/jobs/:id/timesheet", requireAuth, requireJobAccess, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid job id" });
    const entries = await storage.getTimesheetEntriesByJob(id);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: "Failed to load timesheet entries" });
  }
});
