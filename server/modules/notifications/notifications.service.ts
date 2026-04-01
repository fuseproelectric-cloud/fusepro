import { AppError } from "../../core/errors/app-error";
import { notificationsRepository } from "./notifications.repository";

export const notificationsService = {
  async getUnread(userId: number) {
    return notificationsRepository.getUnread(userId);
  },

  async markRead(id: number, userId: number) {
    const updated = await notificationsRepository.markRead(id, userId);
    if (!updated) throw new AppError("Notification not found", 404);
  },

  async markJobRead(userId: number, jobId: number) {
    return notificationsRepository.markJobRead(userId, jobId);
  },
};
