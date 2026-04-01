import { Router } from "express";
import { AppError } from "../../core/errors/app-error";
import { requireAuth, requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { catalogService } from "./catalog.service";
import { insertServiceSchema } from "./catalog.schema";

export const catalogRouter = Router();

// ─── Services (Products & Services catalog) ───────────────────────────────────
catalogRouter.get("/api/services", requireAuth, async (_req, res) => {
  const data = await catalogService.getAllServices();
  res.json(data);
});

catalogRouter.post("/api/services", requireRole("admin", "dispatcher"), async (req, res) => {
  const data = insertServiceSchema.parse(req.body);
  const svc = await catalogService.createService(data);
  res.status(201).json(svc);
});

catalogRouter.put("/api/services/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new AppError("Invalid id", 400);
  const data = insertServiceSchema.partial().parse(req.body);
  const svc = await catalogService.updateService(id, data);
  res.json(svc);
});

catalogRouter.delete("/api/services/:id", requireRole("admin"), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new AppError("Invalid id", 400);
  await catalogService.deleteService(id);
  res.json({ message: "Service deleted" });
});
