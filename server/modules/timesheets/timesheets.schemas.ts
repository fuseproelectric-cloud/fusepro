import { z } from "zod";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const optionalDateStr = dateStr.optional();

// ─── Param schemas ────────────────────────────────────────────────────────────

export const entryIdParamsSchema = z.object({
  id: z.string(),
});

export const techIdParamsSchema = z.object({
  techId: z.string(),
});

// ─── Query schemas ────────────────────────────────────────────────────────────

export const weekQuerySchema = z.object({
  weekOf: optionalDateStr,
});

export const earningsQuerySchema = z.object({
  from: optionalDateStr,
  to:   optionalDateStr,
});

export const adminDateQuerySchema = z.object({
  date: optionalDateStr,
});

export const reportQuerySchema = z.object({
  from: dateStr,
  to:   dateStr,
});

export const adminWeekQuerySchema = z.object({
  weekOf: optionalDateStr,
});

// ─── Body schemas ─────────────────────────────────────────────────────────────

export const approveBodySchema = z.object({
  technicianId: z.number().int().positive(),
  date:         dateStr,
});

export const adminEditEntryBodySchema = z.object({
  entryType: z.string().optional(),
  timestamp: z.string().optional(),
  notes:     z.string().nullable().optional(),
});
