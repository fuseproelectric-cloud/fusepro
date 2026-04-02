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
import { jobsRouter } from "./modules/jobs/jobs.routes";
import { timesheetsRouter } from "./modules/timesheets/timesheets.routes";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { storage } from "./storage";
import { parseId } from "./core/utils/parse-id";
import { checkUploadRateLimit } from "./core/middleware/rate-limit.middleware";
import { UPLOADS_DIR, upload } from "./core/middleware/upload.middleware";
import { requireAuth } from "./core/middleware/auth.middleware";
import { jobExecutionService } from "./services/job-execution.service";
import { AuthError, ValidationError, ForbiddenError } from "./core/errors/app-error";
import { canTechnicianTransitionJob, canOverrideJobStatus } from "./core/policies/jobs.policy";
import { healthRouter } from "./modules/health/health.routes";
// Register domain event handlers (timesheet notifications, job realtime updates)
import "./core/events";
// Register background job handlers (notification fan-out)
import "./core/queue";

// ─── Session setup ───────────────────────────────────────────────────────────
const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// ─── Register all routes ──────────────────────────────────────────────────────
export async function registerRoutes(httpServer: Server, app: Express) {
  // Health/readiness probes — no auth, registered first so they are always reachable
  app.use(healthRouter);

  // Serve uploaded files
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Upload photos endpoint
  app.post(
    "/api/upload",
    requireAuth,
    // Rate limit before multer processes the multipart body to avoid wasted disk writes.
    (req, res, next) => {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        || req.socket.remoteAddress || "unknown";
      if (!checkUploadRateLimit(ip)) {
        return res.status(429).json({ message: "Too many upload requests. Please try again later." });
      }
      next();
    },
    upload.array("photos", 10),
    (req, res) => {
      const files = req.files as Express.Multer.File[];
      if (!files?.length) return res.status(400).json({ message: "No files uploaded" });
      const urls = files.map(f => `/uploads/${f.filename}`);
      res.json({ urls });
    },
  );

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
  app.use(jobsRouter);
  app.use(timesheetsRouter);

  // ─── Job status update ───────────────────────────────────────────────────────
  // Thin handler — all orchestration is owned by JobExecutionService.
  // Technician path: validates state machine + invariants + writes atomically.
  // Admin/dispatcher path: status override with no timesheet side effects.
  app.put("/api/jobs/:id/status", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return next(new AuthError());

      const jobId = parseId(req.params.id);
      if (!jobId) return next(new ValidationError("Invalid job id"));

      const { status, notes, lat, lng, address } = req.body;
      if (!status) return next(new ValidationError("status is required"));

      const io: SocketServer = (req.app as any).io;
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const gps = (lat != null && lng != null && Number.isFinite(latNum) && Number.isFinite(lngNum))
        ? { lat: latNum, lng: lngNum, address: address ?? null }
        : undefined;

      if (canTechnicianTransitionJob(user)) {
        const tech = await storage.getTechnicianByUserId(user.id);
        if (!tech) return next(new ForbiddenError());

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
      if (!canOverrideJobStatus(user)) return next(new ForbiddenError());
      const result = await jobExecutionService.adminOverride({ jobId, newStatus: status, notes, io });
      return res.json(result.job);
    } catch (err) {
      // TransitionError extends AppError — handled by error middleware
      next(err);
    }
  });

  // ─── Job Materials routes ─────────────────────────────────────────────────────
}
