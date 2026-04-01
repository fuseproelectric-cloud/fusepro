import { AppError } from "../../core/errors/app-error";
import { dashboardRepository } from "./dashboard.repository";

export const dashboardService = {
  async getStats() {
    return dashboardRepository.getStats();
  },

  async getMyStats(userId: number) {
    const tech = await dashboardRepository.getTechnicianByUserId(userId);
    if (!tech) throw new AppError("No technician profile found", 404);
    return dashboardRepository.getMyStats(tech.id);
  },
};
