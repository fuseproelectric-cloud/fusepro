import { Briefcase, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { MetricCard } from "@/components/page";

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
      <MetricCard label="In Progress" value={inProgressCount} icon={Briefcase}    color="blue" />
      <MetricCard label="Completed"   value={completedCount}  icon={CheckCircle2} color="green" />
      <MetricCard label="Cancelled"   value={cancelledCount}  icon={AlertCircle}  color="slate" />
    </div>
  );
}
