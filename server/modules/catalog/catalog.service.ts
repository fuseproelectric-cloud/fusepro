import { AppError } from "../../core/errors/app-error";
import { catalogRepository } from "./catalog.repository";
import type { InsertService } from "@shared/schema";

export const catalogService = {
  async getAllServices() {
    return catalogRepository.getAll();
  },

  async createService(data: InsertService) {
    return catalogRepository.create(data);
  },

  async updateService(id: number, data: Partial<InsertService>) {
    const svc = await catalogRepository.update(id, data);
    if (!svc) throw new AppError("Service not found", 404);
    return svc;
  },

  async deleteService(id: number) {
    return catalogRepository.delete(id);
  },
};
