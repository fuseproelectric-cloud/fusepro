import { Router } from "express";
import { z } from "zod";
import { insertInventorySchema } from "@shared/schema";
import { requireAuth, requireRole } from "../../core/middleware/auth.middleware";
import { parseId } from "../../core/utils/parse-id";
import { inventoryRepository } from "./inventory.repository";

export const inventoryRouter = Router();

// ─── Inventory ───────────────────────────────────────────────────────────────
inventoryRouter.get("/api/inventory", requireAuth, async (_req, res) => {
  try {
    const data = await inventoryRepository.getAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to load inventory" });
  }
});

inventoryRouter.get("/api/inventory/:id", requireAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const item = await inventoryRepository.getById(id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: "Failed to load item" });
  }
});

inventoryRouter.post("/api/inventory", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const data = insertInventorySchema.parse(req.body);
    const item = await inventoryRepository.create(data);
    res.status(201).json(item);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to create inventory item" });
  }
});

inventoryRouter.put("/api/inventory/:id", requireRole("admin", "dispatcher"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    const data = insertInventorySchema.partial().parse(req.body);
    const item = await inventoryRepository.update(id, data);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors });
    res.status(500).json({ message: "Failed to update inventory item" });
  }
});

inventoryRouter.delete("/api/inventory/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    await inventoryRepository.delete(id);
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete inventory item" });
  }
});
