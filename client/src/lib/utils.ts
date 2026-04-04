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
  active: "bg-green-500/20 text-green-400 border-green-500/80",
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

// ── MUI Chip sx helpers ──────────────────────────────────────────────────────
// Used by pages that render status/priority as MUI Chip instead of raw spans.
type ChipColors = { bgcolor: string; color: string; border: string };

const _blue:   ChipColors = { bgcolor: "rgba(59,130,246,.12)",  color: "#1d4ed8", border: "1px solid rgba(59,130,246,.3)"  };
const _green:  ChipColors = { bgcolor: "rgba(34,197,94,.12)",   color: "#166534", border: "1px solid rgba(34,197,94,.3)"   };
const _yellow: ChipColors = { bgcolor: "rgba(234,179,8,.12)",   color: "#854d0e", border: "1px solid rgba(234,179,8,.3)"   };
const _red:    ChipColors = { bgcolor: "rgba(239,68,68,.12)",   color: "#991b1b", border: "1px solid rgba(239,68,68,.3)"   };
const _gray:   ChipColors = { bgcolor: "rgba(107,114,128,.12)", color: "#374151", border: "1px solid rgba(107,114,128,.3)" };
const _purple: ChipColors = { bgcolor: "rgba(168,85,247,.12)",  color: "#6b21a8", border: "1px solid rgba(168,85,247,.3)"  };

const STATUS_CHIP_COLORS: Record<string, ChipColors> = {
  pending: _yellow, assigned: _blue, in_progress: _blue, on_the_way: _blue,
  completed: _green, cancelled: _gray, draft: _gray, sent: _blue,
  approved: _green, rejected: _red, paid: _green, overdue: _red,
  available: _green, on_job: _blue, inactive: _gray, active: _green,
  awaiting_response: _blue, changes_requested: _yellow,
  converted: _green, archived: _gray, new: _blue, assessment_scheduled: _purple,
};

const PRIORITY_CHIP_COLORS: Record<string, ChipColors> = {
  low: _gray, normal: _blue, high: _red, emergency: _red,
};

const _chipBase = { fontSize: "0.6875rem", fontWeight: 600, height: 22 };

export function statusChipSx(status: string) {
  return { ..._chipBase, ...(STATUS_CHIP_COLORS[status] ?? _gray) };
}

export function priorityChipSx(priority: string) {
  return { ..._chipBase, ...(PRIORITY_CHIP_COLORS[priority] ?? _gray) };
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
