import { Router } from "express";
import { z } from "zod";
import { Server as SocketServer } from "socket.io";
import { insertTechnicianSchema } from "@shared/schema";
import { requireAuth, requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { techniciansRepository } from "./technicians.repository";

export const techniciansRouter = Router();

// ─── Technicians ─────────────────────────────────────────────────────────────

// /me must be registered before /:id to avoid "me" being matched as an id param
techniciansRouter.get("/api/technicians/me", requireAuth, async (req, res) => {
  try {
    const tech = await techniciansRepository.getByUserId(req.session.userId!);
    if (!tech) return res.status(404).json({ message: "No technician profile found" });
    res.json(tech);
  } catch (err) {
    res.status(500).json({ message: "Failed to load technician profile" });
  }
});

techniciansRouter.get("/api/technicians", requireAuth, async (_req, res) => {
  try {
    const data = await techniciansRepository.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to load technicians" });
  }
});

techniciansRouter.get("/api/technicians/:id", requireAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const tech = await techniciansRepository.getById(id);
    if (!tech) return res.status(404).json({ message: "Technician not found" });
    res.json(tech);
  } catch (err) {
    res.status(500).json({ message: "Failed to load technician" });
  }
});

techniciansRouter.post("/api/technicians", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const data = insertTechnicianSchema.parse(req.body);
    const tech = await techniciansRepository.create(data);
    res.status(201).json(tech);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to create technician" });
  }
});

techniciansRouter.put("/api/technicians/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
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
    const tech = await techniciansRepository.update(id, data);
    if (!tech) return res.status(404).json({ message: "Technician not found" });
    const io: SocketServer = (req.app as any).io;
    io?.to("staff:notifications").emit("technician:updated", tech);
    res.json(tech);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to update technician" });
  }
});

techniciansRouter.delete("/api/technicians/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    await techniciansRepository.delete(id);
    res.json({ message: "Technician deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete technician" });
  }
});

techniciansRouter.put("/api/technicians/:id/rate", requireRole("admin"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const { hourlyRate } = req.body;
    if (hourlyRate == null || isNaN(Number(hourlyRate))) return res.status(400).json({ message: "Invalid rate" });
    await techniciansRepository.update(id, { hourlyRate: String(Number(hourlyRate).toFixed(2)) } as any);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to update rate" });
  }
});
