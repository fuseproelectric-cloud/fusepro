import type { Job, Technician } from "@shared/schema";

export type TechWithUser = Technician & { user?: { id: number; name: string } };
export type Customer = { id: number; name: string };

export const TECH_COLORS = [
  "#f97316", "#3b82f6", "#10b981", "#8b5cf6",
  "#ef4444", "#f59e0b", "#06b6d4", "#ec4899",
] as const;

export function buildTechColorMap(technicians: TechWithUser[]): Map<number, string> {
  return new Map(
    technicians.map((t, i) => [t.id, TECH_COLORS[i % TECH_COLORS.length]])
  );
}

export function getTechName(tech: TechWithUser): string {
  return tech.user?.name ?? `Tech #${tech.id}`;
}

export function getTechColor(
  technicianId: number | null | undefined,
  colorMap: Map<number, string>
): string {
  return technicianId ? (colorMap.get(technicianId) ?? "#6b7280") : "#6b7280";
}

export function isJobScheduled(job: Job): boolean {
  return !!job.scheduledAt && job.status !== "cancelled";
}

export function isJobUnscheduled(job: Job): boolean {
  return !job.scheduledAt && job.status !== "cancelled";
}
