/**
 * Job status lifecycle — single source of truth for all transition rules.
 *
 * Consumed by:
 *   - job-execution.service.ts  (validates transitions, drives timesheet side effects)
 *   - Any future tooling or documentation that needs to enumerate valid flows
 *
 * Nothing in this file touches the database.
 */

// ─── Status type ──────────────────────────────────────────────────────────────

/** All recognized job status values (matches the `status` column in `jobs`). */
export const JOB_STATUSES = [
  "pending",
  "assigned",
  "on_the_way",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

// ─── Technician transition rules ──────────────────────────────────────────────

/**
 * The one valid status a technician may advance a job to, keyed by current status.
 *
 * Each entry is a single allowed forward transition:
 *   assigned → on_the_way → in_progress → completed
 *
 * Admin/dispatcher overrides bypass this map entirely via adminOverride().
 */
export const TECHNICIAN_TRANSITIONS: ReadonlyMap<JobStatus, JobStatus> = new Map([
  ["assigned",    "on_the_way" ],
  ["on_the_way",  "in_progress"],
  ["in_progress", "completed"  ],
]);

/**
 * Statuses that are terminal for technicians.
 * A technician cannot self-advance out of these; an admin/dispatcher must intervene.
 */
export const TECHNICIAN_TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>([
  "completed",
  "cancelled",
]);

// ─── Timesheet side-effect mapping ───────────────────────────────────────────

/**
 * The canonical timesheet entry type produced when a technician moves a job
 * to the given status. Used for activity notification routing.
 *
 * Note: `in_progress` and `completed` may also auto-close an open travel
 * interval (emitting an extra `travel_end`). That conditional write is handled
 * in job-execution.service — this map covers only the primary entry type.
 */
export const TRANSITION_NOTIFICATION_ENTRY: Partial<Record<JobStatus, string>> = {
  on_the_way:  "travel_start",
  in_progress: "work_start",
  completed:   "work_end",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if a technician may advance the job from `from` to `to`.
 * The check is intentionally strict: only the exact next step is valid.
 */
export function isTechnicianTransitionAllowed(from: JobStatus, to: JobStatus): boolean {
  return TECHNICIAN_TRANSITIONS.get(from) === to;
}

/**
 * Returns true if the status is terminal for technicians.
 * Technicians cannot self-advance out of terminal states.
 */
export function isTerminalForTechnician(status: JobStatus): boolean {
  return TECHNICIAN_TERMINAL_STATUSES.has(status);
}

/**
 * Narrows an arbitrary string to `JobStatus`.
 * Returns `undefined` if the value is not a recognized status.
 */
export function toJobStatus(value: string): JobStatus | undefined {
  return (JOB_STATUSES as ReadonlyArray<string>).includes(value)
    ? (value as JobStatus)
    : undefined;
}
