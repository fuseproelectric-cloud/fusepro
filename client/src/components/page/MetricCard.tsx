import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";

const COLOR_CLASSES = {
  blue:    "bg-blue-600 text-white",
  green:   "bg-emerald-500 text-white",
  red:     "bg-red-500 text-white",
  yellow:  "bg-amber-500 text-white",
  purple:  "bg-purple-500 text-white",
  slate:   "bg-muted-foreground/40 text-white",
  neutral: "bg-muted text-muted-foreground",
} as const;

export type MetricCardColor = keyof typeof COLOR_CLASSES;

export interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color?: MetricCardColor;
}

export function MetricCard({ label, value, sub, icon, color = "neutral" }: MetricCardProps) {
  return (
    <div
      className="bg-card rounded-lg border border-border p-4 flex items-start gap-3"
      style={{ boxShadow: "var(--shadow-low)" }}
    >
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", COLOR_CLASSES[color])}>
        <Icon icon={icon} size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground leading-none mb-1">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
