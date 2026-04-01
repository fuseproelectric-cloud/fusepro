import { Router } from "express";
import { z } from "zod";
import { insertEstimateSchema } from "@shared/schema";
import { requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { estimatesRepository } from "./estimates.repository";
import { lifecycleService, LifecycleError } from "../../services/lifecycle.service";

export const estimatesRouter = Router();

// ─── Estimates ────────────────────────────────────────────────────────────────

estimatesRouter.get("/api/estimates", requireRole("admin", "dispatcher"), async (_req, res) => {
  try {
    const data = await estimatesRepository.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to load estimates" });
  }
});

estimatesRouter.get("/api/estimates/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid estimate id" });
    const est = await estimatesRepository.getById(id);
    if (!est) return res.status(404).json({ message: "Estimate not found" });
    res.json(est);
  } catch (err) {
    res.status(500).json({ message: "Failed to load estimate" });
  }
});

estimatesRouter.post("/api/estimates", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const data = insertEstimateSchema.parse(req.body);
    const est = await estimatesRepository.create(data);
    res.status(201).json(est);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to create estimate" });
  }
});

estimatesRouter.put("/api/estimates/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid estimate id" });
    const data = insertEstimateSchema.partial().parse(req.body);
    if (data.status !== undefined) {
      const current = await estimatesRepository.getById(id);
      if (!current) return res.status(404).json({ message: "Estimate not found" });
      lifecycleService.validateEstimateTransition(current.status, data.status);
    }
    const est = await estimatesRepository.update(id, data);
    if (!est) return res.status(404).json({ message: "Estimate not found" });
    res.json(est);
  } catch (err) {
    if (err instanceof LifecycleError) return res.status(err.statusCode).json({ message: err.message });
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to update estimate" });
  }
});

estimatesRouter.delete("/api/estimates/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid estimate id" });
    await estimatesRepository.delete(id);
    res.json({ message: "Estimate deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete estimate" });
  }
});
