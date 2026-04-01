import { Router } from "express";
import { z } from "zod";
import { insertRequestSchema } from "@shared/schema";
import { requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { requestsRepository } from "./requests.repository";
import { lifecycleService, LifecycleError } from "../../services/lifecycle.service";

export const requestsRouter = Router();

// ─── Requests ────────────────────────────────────────────────────────────────
requestsRouter.get("/api/requests", requireRole("admin", "dispatcher"), async (_req, res) => {
  try {
    const data = await requestsRepository.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to load requests" });
  }
});

requestsRouter.get("/api/requests/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid request id" });
    const reqItem = await requestsRepository.getById(id);
    if (!reqItem) return res.status(404).json({ message: "Request not found" });
    res.json(reqItem);
  } catch (err) {
    res.status(500).json({ message: "Failed to load request" });
  }
});

requestsRouter.post("/api/requests", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const data = insertRequestSchema.parse(req.body);
    const reqItem = await requestsRepository.create({
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

requestsRouter.put("/api/requests/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid request id" });
    const current = await requestsRepository.getById(id);
    if (!current) return res.status(404).json({ message: "Request not found" });
    // Block all writes on terminal statuses
    if (["converted", "closed", "archived"].includes(current.status)) {
      return res.status(409).json({ message: `Request is ${current.status} and cannot be modified.` });
    }
    const data = insertRequestSchema.partial().parse(req.body);
    if (data.status !== undefined) {
      lifecycleService.validateRequestTransition(current.status, data.status);
    }
    const reqItem = await requestsRepository.update(id, data);
    if (!reqItem) return res.status(404).json({ message: "Request not found" });
    res.json(reqItem);
  } catch (err) {
    if (err instanceof LifecycleError) return res.status(err.statusCode).json({ message: err.message });
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to update request" });
  }
});

requestsRouter.delete("/api/requests/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid request id" });
    await requestsRepository.delete(id);
    res.json({ message: "Request deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete request" });
  }
});

// ─── Customer requests sub-route ─────────────────────────────────────────────
requestsRouter.get("/api/customers/:id/requests", requireRole("admin", "dispatcher"), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid customer ID" });
  try {
    const reqs = await requestsRepository.getByCustomerId(id);
    res.json(reqs);
  } catch {
    res.status(500).json({ message: "Failed to fetch customer requests" });
  }
});
