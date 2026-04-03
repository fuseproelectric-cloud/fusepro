import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num || 0);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  assigned: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  sent: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  paid: "bg-green-500/20 text-green-400 border-green-500/30",
  overdue: "bg-red-500/20 text-red-400 border-red-500/30",
  available: "bg-green-500/20 text-green-400 border-green-500/30",
  on_job: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  inactive: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  // Estimate statuses (Jobber-style)
  awaiting_response: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  changes_requested: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  converted: "bg-green-500/20 text-green-400 border-green-500/30",
  archived: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  // Request statuses
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  assessment_scheduled: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  normal: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  high: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  emergency: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
