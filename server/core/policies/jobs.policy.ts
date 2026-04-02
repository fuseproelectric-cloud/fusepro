/**
 * Job authorization policies — single source of truth for who may initiate
 * which kind of job status change.
 *
 * Status transition *rules* (which status → which status is valid) live in
 * server/modules/jobs/job-status.lifecycle.ts — this file only covers who
 * is permitted to perform each class of transition.
 *
 * All functions are pure (no I/O) so they are trivially unit-testable.
 */

import type { User } from "@shared/schema";

/**
 * Returns true if the user may perform a technician-owned status transition
 * (assigned → on_the_way → in_progress → completed).
 */
export function canTechnicianTransitionJob(user: User): boolean {
  return user.role === "technician";
}

/**
 * Returns true if the user may override job status as an admin or dispatcher
 * (bypasses state machine validation, no timesheet side effects).
 */
export function canOverrideJobStatus(user: User): boolean {
  return user.role === "admin" || user.role === "dispatcher";
}
