import express from "express";
import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { Server as SocketServer } from "socket.io";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { pool } from "./db";
import { storage } from "./storage";
import { weekBoundsCT, dayBoundsCT, todayStrCT } from "./lib/time";
import { log } from "./index";
import {
  insertUserSchema, insertCustomerSchema, insertCustomerAddressSchema, insertTechnicianSchema,
  insertJobSchema, insertEstimateSchema, insertInvoiceSchema,
  insertInventorySchema, insertJobNoteSchema,
  insertTimesheetSchema, insertJobMaterialSchema,
  insertRequestSchema, insertServiceSchema,
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
import {
  requestConversionService,
  ConversionError,
} from "./services/request-conversion.service";
import {
  estimateConversionService,
} from "./services/estimate-conversion.service";
import {
  customerAddressService,
  AddressError,
} from "./services/customer-address.service";
import { notificationService } from "./services/notification.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Parse a route/body param as a positive integer. Returns null if invalid. */
function parseId(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Simple in-memory login rate limiter: max 10 attempts per IP per 15 minutes
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}
// Cleanup stale entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 15 * 60 * 1000);

// ─── File upload setup ────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Explicit whitelist of accepted image extensions.
// Both conditions must pass — MIME type alone is client-controlled and cannot be trusted.
// Add extensions here only when the rest of the app is confirmed to handle that format.
const ALLOWED_UPLOAD_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = file.mimetype.startsWith("image/");
    const extOk  = ALLOWED_UPLOAD_EXTENSIONS.has(ext);
    // Reject if either check fails — prevents MIME spoofing and non-image extensions.
    cb(null, mimeOk && extOk);
  },
});

// ─── Session setup ───────────────────────────────────────────────────────────
const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

/** Allows admin/dispatcher through unconditionally.
 *  For technicians: verifies the job in :id param is assigned to them. */
export async function requireJobAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
  const user = await storage.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role === "admin" || user.role === "dispatcher") return next();
  if (user.role === "technician") {
    const tech = await storage.getTechnicianByUserId(user.id);
    if (!tech) return res.status(403).json({ message: "Forbidden" });
    const jobId = parseId(req.params.id);
    if (!jobId) return res.status(400).json({ message: "Invalid job id" });
    const job = await storage.getJobById(jobId);
    if (!job || job.technicianId !== tech.id) return res.status(403).json({ message: "Forbidden" });
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
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

  // Socket.IO
  const io = new SocketServer(httpServer, {
    cors: { origin: false },
    path: "/socket.io",
  });

  // Run the Express session middleware on every Socket.IO handshake so that
  // socket.request.session is populated and socket handlers can read userId.
  io.use((socket, next) => {
    sessionMiddleware(socket.request as any, {} as any, next);
  });

  io.on("connection", (socket) => {
    const sessionUserId: number | undefined = (socket.request as any).session?.userId;
    log(`Socket connected: ${socket.id}`, "socket.io");

    socket.on("disconnect", () => {
      log(`Socket disconnected: ${socket.id}`, "socket.io");
    });

    // ── join:staff ────────────────────────────────────────────────────────────
    // Only admin and dispatcher may subscribe to the staff-wide notification room.
    // Technicians must not join this room — events there include cross-job and
    // cross-technician operational data not scoped to a single user.
    socket.on("join:staff", async () => {
      if (!sessionUserId) return;
      const user = await storage.getUserById(sessionUserId);
      if (!user || (user.role !== "admin" && user.role !== "dispatcher")) return;
      socket.join("staff:notifications");
      log(`Socket ${socket.id} joined staff:notifications (user:${sessionUserId})`, "socket.io");
    });

    // ── join:user ─────────────────────────────────────────────────────────────
    // A user may only subscribe to their own notification room.
    socket.on("join:user", (userId: number) => {
      if (sessionUserId && sessionUserId === Number(userId)) {
        socket.join(`user:${sessionUserId}`);
        log(`Socket ${socket.id} joined user:${sessionUserId}`, "socket.io");
      }
    });

    // ── join:job ──────────────────────────────────────────────────────────────
    // Admin and dispatcher: unrestricted access to any job room.
    // Technician: may only join the room for a job they are assigned to.
    // Unauthenticated sockets or unrecognised roles are silently refused.
    socket.on("join:job", async (jobId: number) => {
      if (!sessionUserId) return;
      const id = parseId(jobId);
      if (!id) return;
      const user = await storage.getUserById(sessionUserId);
      if (!user) return;
      if (user.role === "admin" || user.role === "dispatcher") {
        socket.join(`job:${id}`);
        return;
      }
      if (user.role === "technician") {
        const tech = await storage.getTechnicianByUserId(user.id);
        if (!tech) return;
        const job = await storage.getJobById(id);
        if (!job || job.technicianId !== tech.id) return;
        socket.join(`job:${id}`);
      }
    });

    // ── join:conv ─────────────────────────────────────────────────────────────
    // A user may only subscribe to a conversation room if they are a member of
    // that conversation. Membership is verified against the DB on every join.
    socket.on("join:conv", async (convId: number) => {
      if (!sessionUserId) return;
      const id = parseId(convId);
      if (!id) return;
      const members = await storage.getConvMembers(id);
      if (members.some(m => m.id === sessionUserId)) {
        socket.join(`conv:${id}`);
        log(`Socket ${socket.id} joined conv:${id} (user:${sessionUserId})`, "socket.io");
      }
    });

    // ── leave:conv ────────────────────────────────────────────────────────────
    socket.on("leave:conv", (convId: number) => {
      if (!sessionUserId) return;
      const id = parseId(convId);
      if (id) socket.leave(`conv:${id}`);
    });
  });

  // Expose io for use in route handlers
  (app as any).io = io;

  // ─── Auth routes ────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      if (!checkLoginRateLimit(ip)) {
        return res.status(429).json({ message: "Too many login attempts. Try again in 15 minutes." });
      }
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      // Always run bcrypt.compare() regardless of whether the user was found.
      // Returning early on a missing user would create a measurable timing difference
      // (~100 ms for bcrypt vs ~1 ms for a DB miss) that leaks whether an email is registered.
      // The dummy hash is a real bcrypt digest; compare() takes the same time as a real check.
      const DUMMY_HASH = "$2b$12$vK7ozzC9hE2Gafr3WqZXzOgARFG2k1AMn50VfACTFP5tupX7h3ruy";
      const valid = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
      if (!user || !valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.userId = user.id;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });
      return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) console.error("Session destroy error:", err);
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(200).json(null);
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(200).json(null);
    }
    return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  });

  // ─── Conversations ──────────────────────────────────────────────────────────
  app.get("/api/conversations/job-list", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const list = await storage.getJobChatList(user.id, user.role);
      res.json(list);
    } catch (err) {
      console.error("job chat list error:", err);
      res.status(500).json({ message: "Failed to load job chats" });
    }
  });

  app.get("/api/conversations", requireAuth, async (req, res) => {
    try {
      const list = await storage.getConversationsForUser(req.session.userId!);
      res.json(list);
    } catch (err) {
      console.error("conversations list error:", err);
      res.status(500).json({ message: "Failed to load conversations" });
    }
  });

  app.post("/api/conversations", requireAuth, async (req, res) => {
    try {
      const { type, name, memberIds, jobId } = req.body;
      if (!type) return res.status(400).json({ message: "type required" });
      const conv = await storage.createConversation({
        type, name, jobId, createdBy: req.session.userId!, memberIds: memberIds ?? [],
      });
      res.status(201).json(conv);
    } catch (err) {
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.post("/api/conversations/direct/:userId", requireAuth, async (req, res) => {
    try {
      const conv = await storage.getOrCreateDirectConversation(req.session.userId!, parseId(req.params.userId));
      res.json(conv);
    } catch (err) {
      res.status(500).json({ message: "Failed to get/create DM" });
    }
  });

  app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const convId = parseId(req.params.id);
      if (!convId) return res.status(400).json({ message: "Invalid conversation id" });
      const beforeRaw = req.query.before ? Number(req.query.before) : undefined;
      const before = beforeRaw !== undefined && Number.isFinite(beforeRaw) ? beforeRaw : undefined;
      const msgs = await storage.getConvMessages(convId, 60, before);
      res.json(msgs);
    } catch (err) {
      res.status(500).json({ message: "Failed to load messages" });
    }
  });

  app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const convId = parseId(req.params.id);
      if (!convId) return res.status(400).json({ message: "Invalid conversation id" });
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Content required" });
      const msg = await storage.createConvMessage(convId, req.session.userId!, content.trim());
      const io: SocketServer = (req.app as any).io;
      io?.to(`conv:${convId}`).emit("conv:message", msg);
      // Also notify members not in the room via their personal socket room
      const members = await storage.getConvMembers(convId);
      members.forEach(m => {
        if (m.id !== req.session.userId) {
          io?.to(`user:${m.id}`).emit("conv:unread", { conversationId: convId });
        }
      });
      res.status(201).json(msg);
    } catch (err) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.put("/api/conversations/:id/read", requireAuth, async (req, res) => {
    try {
      const convId = parseId(req.params.id);
      if (!convId) return res.status(400).json({ message: "Invalid conversation id" });
      const { lastId } = req.body;
      if (lastId) await storage.markConvRead(convId, req.session.userId!, Number(lastId));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark read" });
    }
  });

  app.put("/api/conversations/:id/name", requireAuth, async (req, res) => {
    try {
      const convId = parseId(req.params.id);
      if (!convId) return res.status(400).json({ message: "Invalid conversation id" });
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name required" });
      await storage.updateConversationName(convId, name.trim());
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to rename" });
    }
  });

  app.post("/api/conversations/:id/members", requireAuth, async (req, res) => {
    try {
      const convId = parseId(req.params.id);
      const userId = parseId(req.body.userId);
      if (!convId || !userId) return res.status(400).json({ message: "Invalid conversation or user id" });
      await storage.addConvMember(convId, userId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to add member" });
    }
  });

  app.delete("/api/conversations/:id/members/:userId", requireAuth, async (req, res) => {
    try {
      const convId = parseId(req.params.id);
      const userId = parseId(req.params.userId);
      if (!convId || !userId) return res.status(400).json({ message: "Invalid conversation or user id" });
      await storage.removeConvMember(convId, userId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // Safe user list for chat — only id, name, role (no email, no password)
  app.get("/api/users/list", requireAuth, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(u => ({ id: u.id, name: u.name, role: u.role })));
    } catch (err) {
      res.status(500).json({ message: "Failed to load users" });
    }
  });

  // ─── Notifications ──────────────────────────────────────────────────────────
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifs = await storage.getUnreadNotifications(req.session.userId!);
      res.json(notifs);
    } catch (err) {
      res.status(500).json({ message: "Failed to load notifications" });
    }
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const updated = await storage.markNotificationRead(parseId(req.params.id), req.session.userId!);
      if (!updated) return res.status(404).json({ message: "Notification not found" });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark notification read" });
    }
  });

  app.put("/api/notifications/read-job/:jobId", requireAuth, async (req, res) => {
    try {
      await storage.markJobNotificationsRead(req.session.userId!, parseId(req.params.jobId));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark notifications read" });
    }
  });

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", requireAuth, async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (err) {
      console.error("Dashboard stats error:", err);
      res.status(500).json({ message: "Failed to load dashboard stats" });
    }
  });

  // ─── Customers ──────────────────────────────────────────────────────────────
  app.get("/api/customers", requireRole("admin", "dispatcher"), async (_req, res) => {
    try {
      const data = await storage.getAllCustomers();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Failed to load customers" });
    }
  });

  app.get("/api/customers/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const customer = await storage.getCustomerById(parseId(req.params.id));
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      const customerJobs = await storage.getJobsByCustomer(customer.id);
      res.json({ ...customer, jobs: customerJobs });
    } catch (err) {
      res.status(500).json({ message: "Failed to load customer" });
    }
  });

  app.post("/api/customers", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(data);
      res.status(201).json(customer);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(parseId(req.params.id), data);
      if (!customer) return res.status(404).json({ message: "Customer not found" });
      res.json(customer);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      await storage.deleteCustomer(parseId(req.params.id));
      res.json({ message: "Customer deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // ─── Customer Addresses ──────────────────────────────────────────────────────
  app.get("/api/customers/:id/addresses", requireRole("admin", "dispatcher"), async (req, res) => {
    const customerId = parseId(req.params.id);
    if (!customerId) return res.status(400).json({ message: "Invalid customer ID" });
    try {
      const addresses = await customerAddressService.getByCustomer(customerId);
      res.json(addresses);
    } catch (err) {
      res.status(500).json({ message: "Failed to load addresses" });
    }
  });

  app.post("/api/customers/:id/addresses", requireRole("admin", "dispatcher"), async (req, res) => {
    const customerId = parseId(req.params.id);
    if (!customerId) return res.status(400).json({ message: "Invalid customer ID" });
    try {
      const data = insertCustomerAddressSchema.parse({ ...req.body, customerId });
      const addr = await customerAddressService.create(data);
      res.status(201).json(addr);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      if (err instanceof AddressError) return res.status(err.statusCode).json({ message: err.message });
      res.status(500).json({ message: "Failed to create address" });
    }
  });

  app.put("/api/customers/:customerId/addresses/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid address ID" });
    try {
      // customerId is intentionally NOT passed into the service — it derives it from the existing row
      const payload = insertCustomerAddressSchema.partial().parse(req.body);
      const addr = await customerAddressService.update(id, payload);
      res.json(addr);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      if (err instanceof AddressError) return res.status(err.statusCode).json({ message: err.message });
      res.status(500).json({ message: "Failed to update address" });
    }
  });

  app.get("/api/customers/:id/requests", requireRole("admin", "dispatcher"), async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid customer ID" });
    try {
      const reqs = await storage.getRequestsByCustomerId(id);
      res.json(reqs);
    } catch {
      res.status(500).json({ message: "Failed to fetch customer requests" });
    }
  });

  app.delete("/api/customers/:customerId/addresses/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid address ID" });
    try {
      await customerAddressService.delete(id);
      res.json({ message: "Address deleted" });
    } catch (err) {
      if (err instanceof AddressError) return res.status(err.statusCode).json({ message: err.message });
      res.status(500).json({ message: "Failed to delete address" });
    }
  });

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

  app.get("/api/technicians/me", requireAuth, async (req, res) => {
    try {
      const tech = await storage.getTechnicianByUserId(req.session.userId!);
      if (!tech) return res.status(404).json({ message: "No technician profile found" });
      res.json(tech);
    } catch (err) {
      res.status(500).json({ message: "Failed to load technician profile" });
    }
  });

  app.get("/api/dashboard/my-stats", requireAuth, async (req, res) => {
    try {
      const tech = await storage.getTechnicianByUserId(req.session.userId!);
      if (!tech) return res.status(404).json({ message: "No technician profile found" });
      const stats = await storage.getTechnicianMyStats(tech.id);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to load stats" });
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

  app.get("/api/jobs/:id/notes", requireAuth, requireJobAccess, async (req, res) => {
    try {
      const notes = await storage.getJobNotes(parseId(req.params.id));
      res.json(notes);
    } catch (err) {
      res.status(500).json({ message: "Failed to load notes" });
    }
  });

  app.put("/api/jobs/:id/notes/read", requireAuth, requireJobAccess, async (req, res) => {
    try {
      const { lastNoteId } = req.body;
      await storage.markJobNoteRead(req.session.userId!, parseId(req.params.id), Number(lastNoteId));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark read" });
    }
  });

  app.post("/api/jobs/:id/notes", requireAuth, requireJobAccess, async (req, res) => {
    try {
      const data = insertJobNoteSchema.parse({
        ...req.body,
        jobId: parseId(req.params.id),
        userId: req.session.userId,
      });
      const note = await storage.createJobNote(data);
      const sender = await storage.getUserById(req.session.userId!);
      const enriched = { ...note, user: sender ? { id: sender.id, name: sender.name } : null };
      const io: SocketServer = (req.app as any).io;
      io?.to(`job:${data.jobId}`).emit("job:note", enriched);

      // Delegate all notification creation (DB persistence + realtime) to service
      await notificationService.notifyJobNote({
        jobId:   data.jobId,
        noteId:  note.id,
        content: data.content as string,
        sender:  sender ? { id: sender.id, name: sender.name } : null,
        io,
      });

      res.status(201).json(enriched);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  // ─── Technicians ─────────────────────────────────────────────────────────────
  app.get("/api/technicians", requireAuth, async (_req, res) => {
    try {
      const data = await storage.getAllTechnicians();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Failed to load technicians" });
    }
  });

  app.get("/api/technicians/:id", requireAuth, async (req, res) => {
    try {
      const tech = await storage.getTechnicianById(parseId(req.params.id));
      if (!tech) return res.status(404).json({ message: "Technician not found" });
      res.json(tech);
    } catch (err) {
      res.status(500).json({ message: "Failed to load technician" });
    }
  });

  app.post("/api/technicians", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertTechnicianSchema.parse(req.body);
      const tech = await storage.createTechnician(data);
      res.status(201).json(tech);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to create technician" });
    }
  });

  app.put("/api/technicians/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertTechnicianSchema.partial().parse(req.body);
      // 'on_job' is a deprecated value — it must not be set by anyone (dispatcher,
      // admin, or any service). Live operational state is derived from timesheets via
      // getTechnicianCurrentStatus(); it is never persisted back into technicians.status.
      // Blocking this prevents stale label drift and keeps the administrative label
      // semantics clean and separate from timesheet-derived operational state.
      if ((data as any).status === "on_job") {
        return res.status(422).json({
          message: "Status 'on_job' is not a valid administrative label. Use 'available', 'active', or 'inactive'.",
        });
      }
      const tech = await storage.updateTechnician(parseId(req.params.id), data);
      if (!tech) return res.status(404).json({ message: "Technician not found" });
      const io: SocketServer = (req.app as any).io;
      io?.to("staff:notifications").emit("technician:updated", tech);
      res.json(tech);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to update technician" });
    }
  });

  app.delete("/api/technicians/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteTechnician(parseId(req.params.id));
      res.json({ message: "Technician deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete technician" });
    }
  });

  // ─── Estimates ───────────────────────────────────────────────────────────────
  app.get("/api/estimates", requireRole("admin", "dispatcher"), async (_req, res) => {
    try {
      const data = await storage.getAllEstimates();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Failed to load estimates" });
    }
  });

  app.get("/api/estimates/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const est = await storage.getEstimateById(parseId(req.params.id));
      if (!est) return res.status(404).json({ message: "Estimate not found" });
      res.json(est);
    } catch (err) {
      res.status(500).json({ message: "Failed to load estimate" });
    }
  });

  app.post("/api/estimates", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertEstimateSchema.parse(req.body);
      const est = await storage.createEstimate(data);
      res.status(201).json(est);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to create estimate" });
    }
  });

  app.put("/api/estimates/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertEstimateSchema.partial().parse(req.body);
      if (data.status !== undefined) {
        const current = await storage.getEstimateById(parseId(req.params.id));
        if (!current) return res.status(404).json({ message: "Estimate not found" });
        lifecycleService.validateEstimateTransition(current.status, data.status);
      }
      const est = await storage.updateEstimate(parseId(req.params.id), data);
      if (!est) return res.status(404).json({ message: "Estimate not found" });
      res.json(est);
    } catch (err) {
      if (err instanceof LifecycleError) return res.status(err.statusCode).json({ message: err.message });
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to update estimate" });
    }
  });

  app.delete("/api/estimates/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      await storage.deleteEstimate(parseId(req.params.id));
      res.json({ message: "Estimate deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete estimate" });
    }
  });

  // ─── Estimate → Invoice conversion ───────────────────────────────────────────
  // Thin handler — all orchestration is owned by EstimateConversionService.
  // Returns the created invoice only; estimate status update is reflected via
  // client-side query invalidation of /api/estimates.
  app.post("/api/estimates/:id/convert-invoice", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const estimateId = parseId(req.params.id);
      if (!estimateId) return res.status(400).json({ message: "Invalid estimate id" });
      const io: SocketServer = (req.app as any).io;
      const result = await estimateConversionService.toInvoice({
        estimateId,
        performedBy: req.session.userId!,
        paymentTerms: req.body?.paymentTerms,
        io,
      });
      return res.status(201).json(result.invoice);
    } catch (err) {
      if (err instanceof ConversionError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Estimate → Invoice conversion error:", err);
      return res.status(500).json({ message: "Failed to convert estimate to invoice" });
    }
  });

  // ─── Requests ────────────────────────────────────────────────────────────────
  app.get("/api/requests", requireRole("admin", "dispatcher"), async (_req, res) => {
    try {
      const data = await storage.getAllRequests();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Failed to load requests" });
    }
  });

  app.get("/api/requests/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const reqItem = await storage.getRequestById(parseId(req.params.id));
      if (!reqItem) return res.status(404).json({ message: "Request not found" });
      res.json(reqItem);
    } catch (err) {
      res.status(500).json({ message: "Failed to load request" });
    }
  });

  app.post("/api/requests", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertRequestSchema.parse(req.body);
      const reqItem = await storage.createRequest({
        ...data,
        createdByUserId: req.session.userId!,
        ownerUserId: data.ownerUserId ?? req.session.userId!,
      });
      res.status(201).json(reqItem);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to create request" });
    }
  });

  app.put("/api/requests/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const current = await storage.getRequestById(parseId(req.params.id));
      if (!current) return res.status(404).json({ message: "Request not found" });
      // Block all writes on terminal statuses
      if (["converted", "closed", "archived"].includes(current.status)) {
        return res.status(409).json({ message: `Request is ${current.status} and cannot be modified.` });
      }
      const data = insertRequestSchema.partial().parse(req.body);
      if (data.status !== undefined) {
        lifecycleService.validateRequestTransition(current.status, data.status);
      }
      const reqItem = await storage.updateRequest(parseId(req.params.id), data);
      if (!reqItem) return res.status(404).json({ message: "Request not found" });
      res.json(reqItem);
    } catch (err) {
      if (err instanceof LifecycleError) return res.status(err.statusCode).json({ message: err.message });
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to update request" });
    }
  });

  app.delete("/api/requests/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      await storage.deleteRequest(parseId(req.params.id));
      res.json({ message: "Request deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete request" });
    }
  });

  app.post("/api/requests/:id/convert-estimate", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const requestId = parseId(req.params.id);
      if (!requestId) return res.status(400).json({ message: "Invalid request id" });
      const io: SocketServer = (req.app as any).io;
      const result = await requestConversionService.toEstimate({
        requestId,
        performedBy: req.session.userId!,
        io,
      });
      return res.status(201).json(result.entity);
    } catch (err) {
      if (err instanceof ConversionError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Request → Estimate conversion error:", err);
      return res.status(500).json({ message: "Failed to convert request to estimate" });
    }
  });

  app.post("/api/requests/:id/convert-job", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const requestId = parseId(req.params.id);
      if (!requestId) return res.status(400).json({ message: "Invalid request id" });
      const io: SocketServer = (req.app as any).io;
      const result = await requestConversionService.toJob({
        requestId,
        performedBy: req.session.userId!,
        io,
      });
      return res.status(201).json(result.entity);
    } catch (err) {
      if (err instanceof ConversionError) return res.status(err.statusCode).json({ message: err.message });
      console.error("Request → Job conversion error:", err);
      return res.status(500).json({ message: "Failed to convert request to job" });
    }
  });

  // Returns { type: "estimate" | "job", id: number } for a converted request.
  // Used by the UI to build a "View Estimate / View Job" deep link.
  app.get("/api/requests/:id/converted-entity", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const requestId = parseId(req.params.id);
      const reqItem = await storage.getRequestById(requestId);
      if (!reqItem) return res.status(404).json({ message: "Request not found" });
      if (reqItem.status !== "converted" || !reqItem.convertedToType) {
        return res.status(404).json({ message: "Request has not been converted" });
      }
      const entity = reqItem.convertedToType === "estimate"
        ? await storage.getEstimateByRequestId(requestId)
        : await storage.getJobByRequestId(requestId);
      if (!entity) return res.status(404).json({ message: "Converted entity not found" });
      res.json({ type: reqItem.convertedToType, id: entity.id });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch converted entity" });
    }
  });

  // ─── Services (Products & Services catalog) ───────────────────────────────────
  app.get("/api/services", requireAuth, async (_req, res) => {
    try {
      const data = await storage.getAllServices();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Failed to load services" });
    }
  });

  app.post("/api/services", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertServiceSchema.parse(req.body);
      const svc = await storage.createService(data);
      res.status(201).json(svc);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.put("/api/services/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertServiceSchema.partial().parse(req.body);
      const svc = await storage.updateService(parseId(req.params.id), data);
      if (!svc) return res.status(404).json({ message: "Service not found" });
      res.json(svc);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteService(parseId(req.params.id));
      res.json({ message: "Service deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // ─── Invoices ────────────────────────────────────────────────────────────────
  app.get("/api/invoices", requireRole("admin", "dispatcher"), async (_req, res) => {
    try {
      const data = await storage.getAllInvoices();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Failed to load invoices" });
    }
  });

  app.get("/api/invoices/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const inv = await storage.getInvoiceById(parseId(req.params.id));
      if (!inv) return res.status(404).json({ message: "Invoice not found" });
      res.json(inv);
    } catch (err) {
      res.status(500).json({ message: "Failed to load invoice" });
    }
  });

  app.post("/api/invoices", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const invoiceNumber = await storage.getNextInvoiceNumber();
      const body = { ...req.body, invoiceNumber };

      // Auto-derive dueDate from paymentTerms when the caller does not supply one.
      // This is the only place dueDate is computed automatically — it is NOT re-derived
      // on subsequent updates, and 'overdue' status is never set by a background job.
      // Rule: due_on_receipt → dueDate stays null; net_N → today + N calendar days.
      if (!body.dueDate) {
        const NET_DAYS: Record<string, number> = { net_15: 15, net_30: 30, net_60: 60 };
        const days = NET_DAYS[body.paymentTerms as string];
        if (days !== undefined) {
          const d = new Date();
          d.setDate(d.getDate() + days);
          body.dueDate = d;
        }
      }

      const data = insertInvoiceSchema.parse(body);
      const inv = await storage.createInvoice(data);
      res.status(201).json(inv);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.put("/api/invoices/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertInvoiceSchema.partial().parse(req.body);
      if (data.status !== undefined) {
        const current = await storage.getInvoiceById(parseId(req.params.id));
        if (!current) return res.status(404).json({ message: "Invoice not found" });
        lifecycleService.validateInvoiceTransition(current.status, data.status);
      }
      if (data.status === "paid" && !(data as any).paidAt) {
        (data as any).paidAt = new Date();
      }
      const inv = await storage.updateInvoice(parseId(req.params.id), data);
      if (!inv) return res.status(404).json({ message: "Invoice not found" });
      res.json(inv);
    } catch (err) {
      if (err instanceof LifecycleError) return res.status(err.statusCode).json({ message: err.message });
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteInvoice(parseId(req.params.id));
      res.json({ message: "Invoice deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // ─── Inventory ───────────────────────────────────────────────────────────────
  app.get("/api/inventory", requireAuth, async (_req, res) => {
    try {
      const data = await storage.getAllInventory();
      res.json(data);
    } catch (err) {
      res.status(500).json({ message: "Failed to load inventory" });
    }
  });

  app.get("/api/inventory/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getInventoryById(parseId(req.params.id));
      if (!item) return res.status(404).json({ message: "Item not found" });
      res.json(item);
    } catch (err) {
      res.status(500).json({ message: "Failed to load item" });
    }
  });

  app.post("/api/inventory", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertInventorySchema.parse(req.body);
      const item = await storage.createInventoryItem(data);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to create inventory item" });
    }
  });

  app.put("/api/inventory/:id", requireRole("admin", "dispatcher"), async (req, res) => {
    try {
      const data = insertInventorySchema.partial().parse(req.body);
      const item = await storage.updateInventoryItem(parseId(req.params.id), data);
      if (!item) return res.status(404).json({ message: "Item not found" });
      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/:id", requireRole("admin"), async (req, res) => {
    try {
      await storage.deleteInventoryItem(parseId(req.params.id));
      res.json({ message: "Item deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete inventory item" });
    }
  });

  // ─── Settings ────────────────────────────────────────────────────────────────
  app.get("/api/settings", requireRole("admin"), async (_req, res) => {
    try {
      const data = await storage.getAllSettings();
      const map: Record<string, string> = {};
      data.forEach((s) => { if (s.key && s.value) map[s.key] = s.value; });
      res.json(map);
    } catch (err) {
      res.status(500).json({ message: "Failed to load settings" });
    }
  });

  app.put("/api/settings/:key", requireRole("admin"), async (req, res) => {
    try {
      const { value } = req.body;
      const setting = await storage.upsertSetting(req.params.key, value);
      res.json(setting);
    } catch (err) {
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  // ─── Users (admin) ───────────────────────────────────────────────────────────
  app.get("/api/users", requireRole("admin"), async (_req, res) => {
    try {
      const data = await storage.getAllUsers();
      res.json(data.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt })));
    } catch (err) {
      res.status(500).json({ message: "Failed to load users" });
    }
  });

  app.post("/api/users", requireRole("admin"), async (req, res) => {
    try {
      const { email, password, name, role } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }
      const existing = await storage.getUserByEmail(email.toLowerCase().trim());
      if (existing) return res.status(409).json({ message: "Email already in use" });
      const hashed = await bcrypt.hash(password, 12);
      const user = await storage.createUser({
        email: email.toLowerCase().trim(),
        password: hashed,
        name,
        role: role || "technician",
      });
      // Auto-create technician profile when role is technician
      if ((role || "technician") === "technician") {
        await storage.createTechnician({ userId: user.id, status: "available" }).catch(() => {});
      }
      // Add new user to team conversation
      await storage.ensureTeamMember(user.id).catch(() => {});
      res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
    } catch (err) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", requireRole("admin"), async (req, res) => {
    try {
      const { name, email, role, password } = req.body;
      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email.toLowerCase().trim();
      if (role) updateData.role = role;
      if (password) updateData.password = await bcrypt.hash(password, 12);
      const user = await storage.updateUser(parseId(req.params.id), updateData);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
    } catch (err) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireRole("admin"), async (req, res) => {
    try {
      if (parseId(req.params.id) === req.session.userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      await storage.deleteUser(parseId(req.params.id));
      res.json({ message: "User deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete user" });
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

  app.put("/api/technicians/:id/rate", requireRole("admin"), async (req, res) => {
    try {
      const { hourlyRate } = req.body;
      if (hourlyRate == null || isNaN(Number(hourlyRate))) return res.status(400).json({ message: "Invalid rate" });
      await storage.updateTechnician(parseId(req.params.id), { hourlyRate: String(Number(hourlyRate).toFixed(2)) } as any);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to update rate" });
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
  app.get("/api/jobs/:id/materials", requireAuth, requireJobAccess, async (req, res) => {
    try {
      const materials = await storage.getJobMaterials(parseId(req.params.id));
      res.json(materials);
    } catch (err) {
      res.status(500).json({ message: "Failed to load materials" });
    }
  });

  app.post("/api/jobs/:id/materials", requireAuth, requireJobAccess, async (req, res) => {
    try {
      const data = insertJobMaterialSchema.parse({ ...req.body, jobId: parseId(req.params.id) });
      const mat = await storage.createJobMaterial(data);
      res.status(201).json(mat);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
      res.status(500).json({ message: "Failed to create material" });
    }
  });

  app.delete("/api/jobs/:id/materials/:materialId", requireAuth, requireJobAccess, async (req, res) => {
    try {
      const materialId = parseId(req.params.materialId);
      if (!materialId) return res.status(400).json({ message: "Invalid material id" });
      await storage.deleteJobMaterial(materialId);
      res.json({ message: "Material deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete material" });
    }
  });

  // Change own password
  app.put("/api/auth/password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new passwords are required" });
      }
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(401).json({ message: "Current password is incorrect" });
      const hashed = await bcrypt.hash(newPassword, 12);
      await storage.updateUser(user.id, { password: hashed });
      // Regenerate session to invalidate old tokens
      const userId = user.id;
      req.session.regenerate((err) => {
        if (err) return res.status(500).json({ message: "Failed to update password" });
        req.session.userId = userId;
        req.session.save(() => res.json({ message: "Password updated" }));
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to update password" });
    }
  });

  // ─── Connecteam Integration ───────────────────────────────────────────────────

  async function connecteamToken(clientId: string, clientSecret: string): Promise<string> {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://api.connecteam.com/oauth/v1/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error("Invalid Connecteam credentials");
    const data: any = await res.json();
    return data.access_token;
  }

  // GET status + settings (credentials masked)
  app.get("/api/integrations/connecteam", requireRole("admin"), async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const map: Record<string, string> = {};
      settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
      const clientId     = map["connecteam_client_id"]     || "";
      const clientSecret = map["connecteam_client_secret"] || "";
      const lastSync     = map["connecteam_last_sync"]     || null;
      const enabled      = map["connecteam_enabled"]       === "true";
      res.json({
        clientId,
        clientSecretMasked: clientSecret ? "●".repeat(8) + clientSecret.slice(-4) : "",
        hasCredentials: !!(clientId && clientSecret),
        enabled,
        lastSync,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to load Connecteam settings" });
    }
  });

  // PUT save credentials
  app.put("/api/integrations/connecteam", requireRole("admin"), async (req, res) => {
    try {
      const { clientId, clientSecret, enabled } = req.body;
      if (clientId   !== undefined) await storage.upsertSetting("connecteam_client_id",     clientId);
      if (clientSecret !== undefined) await storage.upsertSetting("connecteam_client_secret", clientSecret);
      if (enabled    !== undefined) await storage.upsertSetting("connecteam_enabled",        String(enabled));
      res.json({ message: "Settings saved" });
    } catch (err) {
      res.status(500).json({ message: "Failed to save Connecteam settings" });
    }
  });

  // POST test connection
  app.post("/api/integrations/connecteam/test", requireRole("admin"), async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const map: Record<string, string> = {};
      settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
      const clientId     = map["connecteam_client_id"]     || "";
      const clientSecret = map["connecteam_client_secret"] || "";
      if (!clientId || !clientSecret) return res.status(400).json({ message: "Credentials not configured" });
      const token = await connecteamToken(clientId, clientSecret);
      // Fetch company info to confirm access
      const infoRes = await fetch("https://api.connecteam.com/users/v1/users?limit=1", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!infoRes.ok) throw new Error("API call failed");
      res.json({ message: "Connection successful", token: token.slice(0, 20) + "..." });
    } catch (err: any) {
      console.error("[connecteam] test connection error:", err);
      res.status(400).json({ message: "Connection failed. Check your Connecteam credentials and try again." });
    }
  });

  // GET users from Connecteam
  app.get("/api/integrations/connecteam/users", requireRole("admin"), async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const map: Record<string, string> = {};
      settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
      const token = await connecteamToken(map["connecteam_client_id"], map["connecteam_client_secret"]);
      const r = await fetch("https://api.connecteam.com/users/v1/users?limit=50", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data: any = await r.json();
      res.json(data.data?.users ?? []);
    } catch (err: any) {
      console.error("[connecteam] fetch users error:", err);
      res.status(500).json({ message: "Failed to fetch Connecteam users." });
    }
  });

  // GET jobs from Connecteam
  app.get("/api/integrations/connecteam/jobs", requireRole("admin"), async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const map: Record<string, string> = {};
      settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
      const token = await connecteamToken(map["connecteam_client_id"], map["connecteam_client_secret"]);
      const r = await fetch("https://api.connecteam.com/jobs/v1/jobs?limit=100", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data: any = await r.json();
      res.json(data.data?.jobs ?? []);
    } catch (err: any) {
      console.error("[connecteam] fetch jobs error:", err);
      res.status(500).json({ message: "Failed to fetch Connecteam jobs." });
    }
  });

  // GET time activities from Connecteam
  app.get("/api/integrations/connecteam/time", requireRole("admin"), async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const map: Record<string, string> = {};
      settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
      const token = await connecteamToken(map["connecteam_client_id"], map["connecteam_client_secret"]);
      const { startDate, endDate } = req.query as any;
      const params = new URLSearchParams({ limit: "100" });
      if (startDate) params.set("startDate", startDate);
      if (endDate)   params.set("endDate",   endDate);
      const r = await fetch(`https://api.connecteam.com/time_clock/v1/time_activities?${params}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data: any = await r.json();
      res.json(data.data ?? []);
    } catch (err: any) {
      console.error("[connecteam] fetch time activities error:", err);
      res.status(500).json({ message: "Failed to fetch Connecteam time activities." });
    }
  });

  // POST sync employees → create as technicians in FusPro
  app.post("/api/integrations/connecteam/sync-employees", requireRole("admin"), async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const map: Record<string, string> = {};
      settings.forEach(s => { if (s.key && s.value) map[s.key] = s.value; });
      const token = await connecteamToken(map["connecteam_client_id"], map["connecteam_client_secret"]);
      const r = await fetch("https://api.connecteam.com/users/v1/users?limit=50", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data: any = await r.json();
      const ctUsers: any[] = data.data?.users ?? [];

      // Get existing FusPro users by email
      const existingUsers = await storage.getAllUsers();
      const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));

      let created = 0; let skipped = 0;
      for (const u of ctUsers) {
        if (u.userType === "owner") { skipped++; continue; }
        const email = (u.email || "").toLowerCase();
        if (!email || existingEmails.has(email)) { skipped++; continue; }
        // Create user as technician
        const hashedPw = await bcrypt.hash("FusePro123!", 12);
        const newUser = await storage.createUser({
          email,
          password: hashedPw,
          name: `${u.firstName} ${u.lastName}`.trim(),
          role: "technician",
        });
        // Create technician profile and add to team conversation
        await storage.createTechnician({ userId: newUser.id, status: "available" });
        await storage.ensureTeamMember(newUser.id).catch(() => {});
        created++;
      }

      await storage.upsertSetting("connecteam_last_sync", new Date().toISOString());
      res.json({ message: `Sync complete: ${created} created, ${skipped} skipped`, created, skipped });
    } catch (err: any) {
      console.error("[connecteam] sync-employees error:", err);
      res.status(500).json({ message: "Employee sync failed." });
    }
  });
}
