/**
 * Timesheet authorization policies — single source of truth for who may perform
 * each timesheet management action.
 *
 * All functions are pure (no I/O) so they are trivially unit-testable.
 * Enforcement happens via requirePolicy() in auth.middleware.ts.
 */

import type { User } from "@shared/schema";

/** Returns true if the user may view admin-level timesheet data. */
export function canViewAdminTimesheets(user: User): boolean {
  return user.role === "admin" || user.role === "dispatcher";
}

/** Returns true if the user may approve or unapprove a timesheet day. */
export function canApproveTimesheets(user: User): boolean {
  return user.role === "admin" || user.role === "dispatcher";
}

/** Returns true if the user may edit an individual timesheet entry. */
export function canEditTimesheetEntry(user: User): boolean {
  return user.role === "admin" || user.role === "dispatcher";
}

/** Returns true if the user may delete an individual timesheet entry. */
export function canDeleteTimesheetEntry(user: User): boolean {
  return user.role === "admin" || user.role === "dispatcher";
}
