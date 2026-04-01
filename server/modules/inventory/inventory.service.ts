import { AppError } from "../../core/errors/app-error";
import { inventoryRepository } from "./inventory.repository";
import type { InsertInventoryItem } from "@shared/schema";

export const inventoryService = {
  async getAllInventory() {
    return inventoryRepository.getAll();
  },

  async getInventoryById(id: number) {
    const item = await inventoryRepository.getById(id);
    if (!item) throw new AppError("Item not found", 404);
    return item;
  },

  async createInventoryItem(data: InsertInventoryItem) {
    return inventoryRepository.create(data);
  },

  async updateInventoryItem(id: number, data: Partial<InsertInventoryItem>) {
    const item = await inventoryRepository.update(id, data);
    if (!item) throw new AppError("Item not found", 404);
    return item;
  },

  async deleteInventoryItem(id: number) {
    return inventoryRepository.delete(id);
  },
};
