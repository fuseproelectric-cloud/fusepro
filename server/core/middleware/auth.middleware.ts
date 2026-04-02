import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { storage } from "../../storage";
import { parseId } from "../utils/parse-id";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

/**
 * Middleware factory that enforces a policy function against the authenticated user.
 * Use this to wire policy functions from server/core/policies/ into route definitions.
 *
 * Returns 401 when not authenticated, 403 when the policy rejects the user.
 */
export function requirePolicy(policy: (user: User) => boolean) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user || !policy(user)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

/** Allows admin/dispatcher through unconditionally.
 *  For technicians: verifies the job in :id param is assigned to them. */
export async function requireJobAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
  const user = await storage.getUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role === "admin" || user.role === "dispatcher") return next();
  if (user.role === "technician") {
    const tech = await storage.getTechnicianByUserId(user.id);
    if (!tech) return res.status(403).json({ message: "Forbidden" });
    const jobId = parseId(req.params.id);
    if (!jobId) return res.status(400).json({ message: "Invalid job id" });
    const job = await storage.getJobById(jobId);
    if (!job || job.technicianId !== tech.id) return res.status(403).json({ message: "Forbidden" });
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
}
