/**
 * Canonical Job Form — single source of truth for all job create/edit forms.
 *
 * Used by: JobsPage, CreateJobDialog, CustomerAddressPage
 */
import { z } from "zod";
import type { Job } from "@shared/schema";

// ── Schema ────────────────────────────────────────────────────────────────────

export const jobFormSchema = z.object({
  title:             z.string().min(1, "Title is required"),
  description:       z.string().optional(),
  instructions:      z.string().optional(),
  notes:             z.string().optional(),
  customerId:        z.number({ coerce: true }).optional().nullable(),
  technicianId:      z.number({ coerce: true }).optional().nullable(),
  // Status is manually selectable in edit mode only.
  // In create mode it is derived from technicianId in buildJobPayload().
  status:            z.string().default("pending"),
  priority:          z.string().default("normal"),
  // Scheduling: separate date + start time + end time (better UX than datetime-local).
  // Duration is auto-calculated from the difference; stored in estimatedDuration.
  dateStr:           z.string().optional(),
  timeStr:           z.string().optional(),
  endTimeStr:        z.string().optional(),
  // Address fields
  address:           z.string().optional(),
  city:              z.string().optional(),
  state:             z.string().optional(),
  zip:               z.string().optional(),
});

export type JobFormValues = z.infer<typeof jobFormSchema>;

// ── Defaults ──────────────────────────────────────────────────────────────────

export const JOB_FORM_DEFAULTS: JobFormValues = {
  title:        "",
  description:  "",
  instructions: "",
  notes:        "",
  customerId:   null,
  technicianId: null,
  status:       "pending",
  priority:     "normal",
  dateStr:      "",
  timeStr:      "",
  endTimeStr:   "",
  address:      "",
  city:         "",
  state:        "",
  zip:          "",
};

// ── Canonical options ─────────────────────────────────────────────────────────

export const JOB_PRIORITY_OPTIONS = [
  { value: "low",       label: "Low" },
  { value: "normal",    label: "Normal" },
  { value: "high",      label: "High" },
  { value: "emergency", label: "Emergency" },
] as const;

export const JOB_STATUS_OPTIONS = [
  { value: "pending",     label: "Pending" },
  { value: "assigned",    label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed" },
  { value: "cancelled",   label: "Cancelled" },
] as const;

// ── Map existing Job → form values (edit mode) ────────────────────────────────

export function mapJobToForm(job: Job): JobFormValues {
  let dateStr = "";
  let timeStr = "";
  let endTimeStr = "";

  if (job.scheduledAt) {
    const start = new Date(job.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    dateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    timeStr = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
    // Derive end time from estimatedDuration (default 60 min)
    const endMs = start.getTime() + (job.estimatedDuration ?? 60) * 60_000;
    const end = new Date(endMs);
    endTimeStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  }

  return {
    title:        job.title,
    description:  job.description ?? "",
    instructions: job.instructions ?? "",
    notes:        job.notes ?? "",
    customerId:   job.customerId ?? null,
    technicianId: job.technicianId ?? null,
    status:       job.status,
    priority:     job.priority,
    dateStr,
    timeStr,
    endTimeStr,
    address:      job.address ?? "",
    city:         job.city ?? "",
    state:        job.state ?? "",
    zip:          job.zip ?? "",
  };
}

// ── Build API payload from form values ────────────────────────────────────────

export function buildJobPayload(
  data: JobFormValues,
  opts: {
    /** In create mode, status is auto-derived from technicianId. */
    isCreate?: boolean;
    /** Override customer/address when they are locked from context. */
    lockedCustomerId?: number | null;
    lockedAddress?: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null;
  } = {},
) {
  const { isCreate = false, lockedCustomerId, lockedAddress } = opts;

  // Scheduling
  let scheduledAt: Date | null = null;
  let estimatedDuration: number | null = null;

  if (data.dateStr && data.timeStr) {
    scheduledAt = new Date(`${data.dateStr}T${data.timeStr}:00`);
    if (data.endTimeStr) {
      const startMs = scheduledAt.getTime();
      const endMs   = new Date(`${data.dateStr}T${data.endTimeStr}:00`).getTime();
      estimatedDuration = Math.max(15, Math.round((endMs - startMs) / 60_000));
    }
  }

  // Address: prefer locked context address, fall back to form fields
  const address = lockedAddress?.address ?? (data.address?.trim() || null);
  const city    = lockedAddress?.city    ?? (data.city?.trim()    || null);
  const state   = lockedAddress?.state   ?? (data.state?.trim()   || null);
  const zip     = lockedAddress?.zip     ?? (data.zip?.trim()     || null);

  const customerId   = lockedCustomerId !== undefined ? lockedCustomerId : (data.customerId || null);
  const technicianId = data.technicianId || null;

  // In create mode, auto-derive status from technicianId
  const status = isCreate
    ? (technicianId ? "assigned" : "pending")
    : data.status;

  return {
    title:             data.title.trim(),
    description:       data.description?.trim()  || null,
    instructions:      data.instructions?.trim() || null,
    notes:             data.notes?.trim()         || null,
    customerId,
    technicianId,
    status,
    priority:          data.priority || "normal",
    scheduledAt,
    estimatedDuration,
    address,
    city,
    state,
    zip,
  };
}
