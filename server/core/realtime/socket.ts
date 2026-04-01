import type { Server } from "http";
import type { Express } from "express";
import { Server as SocketServer } from "socket.io";
import { storage } from "../../storage";
import { parseId } from "../utils/parse-id";
import { log } from "../utils/logger";

export function createSocketServer(
  httpServer: Server,
  app: Express,
  sessionMiddleware: (req: any, res: any, next: any) => void,
): SocketServer {
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

  return io;
}
