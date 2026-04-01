import { Router } from "express";
import { AppError } from "../../core/errors/app-error";
import { requireAuth, requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { inventoryService } from "./inventory.service";
import { insertInventorySchema } from "./inventory.schema";

export const inventoryRouter = Router();

// ─── Inventory ───────────────────────────────────────────────────────────────
inventoryRouter.get("/api/inventory", requireAuth, async (_req, res) => {
  const data = await inventoryService.getAllInventory();
  res.json(data);
});

inventoryRouter.get("/api/inventory/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new AppError("Invalid id", 400);
  const item = await inventoryService.getInventoryById(id);
  res.json(item);
});

inventoryRouter.post("/api/inventory", requireRole("admin", "dispatcher"), async (req, res) => {
  const data = insertInventorySchema.parse(req.body);
  const item = await inventoryService.createInventoryItem(data);
  res.status(201).json(item);
});

inventoryRouter.put("/api/inventory/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new AppError("Invalid id", 400);
  const data = insertInventorySchema.partial().parse(req.body);
  const item = await inventoryService.updateInventoryItem(id, data);
  res.json(item);
});

inventoryRouter.delete("/api/inventory/:id", requireRole("admin"), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw new AppError("Invalid id", 400);
  await inventoryService.deleteInventoryItem(id);
  res.json({ message: "Item deleted" });
});
