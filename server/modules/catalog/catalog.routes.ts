import { Router } from "express";
import { z } from "zod";
import { insertServiceSchema } from "@shared/schema";
import { requireAuth, requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { catalogRepository } from "./catalog.repository";

export const catalogRouter = Router();

// ─── Services (Products & Services catalog) ───────────────────────────────────
catalogRouter.get("/api/services", requireAuth, async (_req, res) => {
  try {
    const data = await catalogRepository.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to load services" });
  }
});

catalogRouter.post("/api/services", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const data = insertServiceSchema.parse(req.body);
    const svc = await catalogRepository.create(data);
    res.status(201).json(svc);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to create service" });
  }
});

catalogRouter.put("/api/services/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const data = insertServiceSchema.partial().parse(req.body);
    const svc = await catalogRepository.update(id, data);
    if (!svc) return res.status(404).json({ message: "Service not found" });
    res.json(svc);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to update service" });
  }
});

catalogRouter.delete("/api/services/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    await catalogRepository.delete(id);
    res.json({ message: "Service deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete service" });
  }
});
