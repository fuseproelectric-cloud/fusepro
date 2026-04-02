import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { Server as SocketServer } from "socket.io";
import { storage } from "../../storage";
import { weekBoundsCT, dayBoundsCT, todayStrCT } from "../../lib/time";
import { parseId } from "../../core/utils/parse-id";
import { requireAuth, requireRole } from "../../core/middleware/auth.middleware";
import { insertTimesheetSchema } from "@shared/schema";
import {
  timesheetService,
  JOB_LIFECYCLE_ENTRY_TYPES,
} from "../../services/timesheet.service";
import { notificationService } from "../../services/notification.service";
import {
  AuthError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../../core/errors/app-error";
import {
  weekQuerySchema,
  earningsQuerySchema,
  adminDateQuerySchema,
  reportQuerySchema,
  approveBodySchema,
  adminEditEntryBodySchema,
} from "./timesheets.schemas";

export const timesheetsRouter = Router();

// ─── GET /api/timesheet/today ─────────────────────────────────────────────────

timesheetsRouter.get("/api/timesheet/today", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return next(new AuthError());
    const tech = await storage.getTechnicianByUserId(user.id);
    if (!tech) return next(new NotFoundError("No technician profile found"));
    const entries = await storage.getTodayTimesheets(tech.id);
    const status = await storage.getTechnicianCurrentStatus(tech.id);
    res.json({ entries, status });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/timesheet/week ──────────────────────────────────────────────────

timesheetsRouter.get("/api/timesheet/week", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return next(new AuthError());
    const tech = await storage.getTechnicianByUserId(user.id);
    if (!tech) return next(new NotFoundError("No technician profile found"));

    const { weekOf: weekOfParam } = weekQuerySchema.parse(req.query);
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
    next(err);
  }
});

// ─── POST /api/timesheet ──────────────────────────────────────────────────────
// Day-lifecycle and breaks only. Job-lifecycle entries (travel_start/end,
// work_start/end) are owned by PUT /api/jobs/:id/status via JobExecutionService.
// Submitting them here returns HTTP 400 with a clear error.

timesheetsRouter.post("/api/timesheet", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return next(new AuthError());
    const tech = await storage.getTechnicianByUserId(user.id);
    if (!tech) return next(new NotFoundError("No technician profile found"));

    const { entryType } = req.body;

    // Reject job-lifecycle entry types — these belong to the job status flow
    if (JOB_LIFECYCLE_ENTRY_TYPES.has(entryType)) {
      return next(new ValidationError(
        `'${entryType}' is a job lifecycle entry and is managed automatically via ` +
        `PUT /api/jobs/:id/status. Do not submit it here.`,
      ));
    }

    // Validate and parse the request body.
    // Force technicianId from session and strip any client-provided timestamp —
    // the service always overwrites timestamp with new Date() server-side.
    const { timestamp: _ignored, ...bodyWithoutTimestamp } = req.body;
    const data = insertTimesheetSchema.parse({ ...bodyWithoutTimestamp, technicianId: tech.id });

    // Dispatch to the appropriate TimesheetService method
    let entry;
    switch (data.entryType) {
      case "day_start":   entry = await timesheetService.startDay(data);   break;
      case "day_end":     entry = await timesheetService.endDay(data);     break;
      case "break_start": entry = await timesheetService.startBreak(data); break;
      case "break_end":   entry = await timesheetService.endBreak(data);   break;
      default:
        return next(new ValidationError(`Unknown entry type: ${data.entryType}`));
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
    // TimesheetValidationError extends AppError — handled by error middleware
    next(err);
  }
});

// ─── GET /api/timesheet/earnings ─────────────────────────────────────────────

timesheetsRouter.get("/api/timesheet/earnings", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await storage.getUserById(req.session.userId!);
    if (!user) return next(new AuthError());
    const tech = await storage.getTechnicianByUserId(user.id);
    if (!tech) return next(new NotFoundError("No technician profile"));
    const { from: fromParam, to: toParam } = earningsQuerySchema.parse(req.query);
    const from = fromParam ?? todayStrCT();
    const to   = toParam   ?? todayStrCT();
    const data = await storage.getTechnicianEarnings(tech.id, from, to);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/timesheets ────────────────────────────────────────────────

timesheetsRouter.get("/api/admin/timesheets", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adminDateQuerySchema.safeParse(req.query);
    const dateParam = parsed.success && parsed.data.date ? parsed.data.date : todayStrCT();
    // Validate format YYYY-MM-DD (also enforced by schema, but guard for fallback path)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return next(new ValidationError("Invalid date"));
    const data = await storage.getAllTimesheetsByDate(dateParam);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/timesheets/report ────────────────────────────────────────

timesheetsRouter.get("/api/admin/timesheets/report", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = reportQuerySchema.safeParse(req.query);
    if (!result.success) return next(new ValidationError("Invalid from/to date"));
    const { from, to } = result.data;
    const data = await storage.getAllTimesheetsByRange(from, to);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/timesheets/week/:techId ───────────────────────────────────

timesheetsRouter.get("/api/admin/timesheets/week/:techId", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const techId = parseId(req.params.techId);
    if (!techId) return next(new ValidationError("Invalid technician id"));
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
    next(err);
  }
});

// ─── PUT /api/admin/timesheets/entries/:id ────────────────────────────────────

timesheetsRouter.put("/api/admin/timesheets/entries/:id", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return next(new ValidationError("Invalid entry id"));
    const existing = await storage.getTimesheetEntryById(id);
    if (!existing) return next(new NotFoundError("Entry not found"));
    // Block edits on approved days — use unapprove endpoint first
    const dateStr = new Date(existing.timestamp).toISOString().slice(0, 10);
    const approvals = await storage.getTimesheetApprovals(existing.technicianId, [dateStr]);
    if (approvals[dateStr]) {
      return next(new ConflictError("This day is approved. Unapprove it before editing entries."));
    }
    const body = adminEditEntryBodySchema.parse(req.body);
    const update: { entryType?: string; timestamp?: Date; notes?: string | null } = {};
    if (body.entryType !== undefined) update.entryType = body.entryType;
    if (body.timestamp !== undefined) update.timestamp = new Date(body.timestamp);
    if (body.notes !== undefined) update.notes = body.notes ?? null;
    const entry = await storage.updateTimesheetEntry(id, update);
    if (!entry) return next(new NotFoundError("Entry not found"));
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/timesheets/entries/:id ─────────────────────────────────

timesheetsRouter.delete("/api/admin/timesheets/entries/:id", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return next(new ValidationError("Invalid entry id"));
    const existing = await storage.getTimesheetEntryById(id);
    if (!existing) return next(new NotFoundError("Entry not found"));
    // Block deletes on approved days — use unapprove endpoint first
    const dateStr = new Date(existing.timestamp).toISOString().slice(0, 10);
    const approvals = await storage.getTimesheetApprovals(existing.technicianId, [dateStr]);
    if (approvals[dateStr]) {
      return next(new ConflictError("This day is approved. Unapprove it before deleting entries."));
    }
    await storage.deleteTimesheetEntry(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/timesheets/approve ──────────────────────────────────────

timesheetsRouter.post("/api/admin/timesheets/approve", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = approveBodySchema.safeParse(req.body);
    if (!result.success) return next(new ValidationError("technicianId and date required"));
    const { technicianId, date } = result.data;
    await storage.approveTimesheetDay(technicianId, date, req.session.userId!);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/timesheets/approve ─────────────────────────────────────

timesheetsRouter.delete("/api/admin/timesheets/approve", requireRole("admin", "dispatcher"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = approveBodySchema.safeParse(req.body);
    if (!result.success) return next(new ValidationError("technicianId and date required"));
    const { technicianId, date } = result.data;
    await storage.unapproveTimesheetDay(technicianId, date);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
