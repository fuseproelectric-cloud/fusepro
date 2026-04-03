import { Briefcase, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/Icon";

function MetricCard({ label, value, icon, color }: {
  label: string;
  value: number;
  icon: LucideIcon;
  color: "yellow" | "orange" | "green" | "slate";
}) {
  const bg = {
    yellow: "bg-amber-500",
    orange: "bg-blue-500",
    green:  "bg-emerald-500",
    slate:  "bg-muted-foreground/40",
  }[color];

  return (
    <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3" style={{ boxShadow: "var(--shadow-low)" }}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-white", bg)}>
        <Icon icon={icon} size={17} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none mb-1">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

interface JobsMetricsProps {
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
}

export function JobsMetrics({ pendingCount, inProgressCount, completedCount, cancelledCount }: JobsMetricsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard label="Pending"     value={pendingCount}    icon={Clock}        color="yellow" />
      <MetricCard label="In Progress" value={inProgressCount} icon={Briefcase}    color="orange" />
      <MetricCard label="Completed"   value={completedCount}  icon={CheckCircle2} color="green"  />
      <MetricCard label="Cancelled"   value={cancelledCount}  icon={AlertCircle}  color="slate"  />
    </div>
  );
}
