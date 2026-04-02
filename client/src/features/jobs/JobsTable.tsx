import { useLocation } from "wouter";
import { cn, formatDateTime, formatStatus } from "@/lib/utils";
import type { Job, Customer } from "@shared/schema";
import type { TechWithUser } from "./hooks/useJobsData";
import {
  Plus, MoreVertical, Pencil, Trash2,
  Briefcase, User, MapPin, UserCheck, ArrowRight,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── helpers ──────────────────────────────────────────────────────────────── */

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:     { label: "Pending",     cls: "bg-amber-100 text-amber-700" },
  assigned:    { label: "Assigned",    cls: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress", cls: "bg-orange-100 text-orange-700" },
  completed:   { label: "Completed",   cls: "bg-emerald-100 text-emerald-700" },
  cancelled:   { label: "Cancelled",   cls: "bg-muted/40 text-muted-foreground" },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  low:       { label: "Low",       cls: "bg-muted/40 text-muted-foreground" },
  normal:    { label: "Normal",    cls: "bg-blue-100 text-blue-600" },
  high:      { label: "High",      cls: "bg-orange-100 text-orange-700" },
  emergency: { label: "Emergency", cls: "bg-red-100 text-red-700" },
};
void PRIORITY_META; // defined for future use; currently only PriorityDot is used

const nextStatus: Record<string, string> = {
  pending: "assigned", assigned: "in_progress", in_progress: "completed",
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: formatStatus(status), cls: "bg-muted/40 text-muted-foreground" };
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap",
      m.cls,
    )}>
      {m.label}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low:       "bg-muted-foreground/40",
    normal:    "bg-blue-500",
    high:      "bg-orange-500",
    emergency: "bg-red-500",
  };
  return <span className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0", colors[priority] ?? "bg-muted-foreground/40")} />;
}

/* ─── component ─────────────────────────────────────────────────────────────── */

interface JobsTableProps {
  isLoading: boolean;
  jobs: Job[];
  filtered: Job[];
  customers: Customer[];
  technicians: TechWithUser[];
  onEdit: (job: Job) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
  isStatusPending: boolean;
  onOpenCreate: () => void;
  search: string;
  filterStatus: string;
}

export function JobsTable({
  isLoading, jobs, filtered, customers, technicians,
  onEdit, onDelete, onStatusChange, isStatusPending,
  onOpenCreate, search, filterStatus,
}: JobsTableProps) {
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-low)" }}>
        <div className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    );
  }

  const hasFilters = !!(search || filterStatus !== "all");

  if (filtered.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-low)" }}>
        <div className="empty-state">
          <div className="empty-state__icon"><Icon icon={Briefcase} size={28} /></div>
          <p className="empty-state__title">{hasFilters ? "No jobs match your filters" : "No jobs yet"}</p>
          <p className="empty-state__desc">{hasFilters ? "Try different search terms or clear filters." : "Create your first job to get started."}</p>
          {!hasFilters && (
            <Button onClick={onOpenCreate} className="mt-4 h-8 bg-orange-500 hover:bg-orange-600 text-white text-sm">
              <Icon icon={Plus} size={14} className="mr-1.5" />New Job
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-low)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Job #</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Job</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Client</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Technician</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Priority</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Scheduled</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(job => {
              const customer = customers.find(c => c.id === job.customerId);
              const tech     = technicians.find(t => t.id === job.technicianId);
              const canAdv   = nextStatus[job.status];
              return (
                <tr
                  key={job.id}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/30 cursor-pointer group transition-colors"
                  onClick={() => navigate(`/job/${job.id}`)}
                >
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-mono text-xs text-muted-foreground">{job.jobNumber ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground truncate max-w-[200px]">{job.title}</p>
                    {job.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate max-w-[200px]">
                        <Icon icon={MapPin} size={12} className="flex-shrink-0" />{job.address}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {customer
                      ? <div className="flex items-center gap-1.5"><Icon icon={User} size={12} className="text-muted-foreground/60" /><span className="text-sm text-foreground">{customer.name}</span></div>
                      : <span className="text-sm text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {tech?.user?.name
                      ? <div className="flex items-center gap-1.5"><Icon icon={UserCheck} size={12} className="text-muted-foreground/60" /><span className="text-sm text-foreground">{tech.user.name}</span></div>
                      : <span className="text-xs text-amber-600 font-medium">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <PriorityDot priority={job.priority} />
                      <span className="text-xs text-muted-foreground capitalize">{job.priority}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                    {job.scheduledAt ? formatDateTime(job.scheduledAt) : "—"}
                  </td>
                  <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Icon icon={MoreVertical} size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => navigate(`/job/${job.id}`)}>View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(job)}>
                          <Icon icon={Pencil} size={16} className="mr-2" />Edit
                        </DropdownMenuItem>
                        {canAdv && (
                          <DropdownMenuItem
                            disabled={isStatusPending}
                            onClick={() => onStatusChange(job.id, canAdv)}
                          >
                            <Icon icon={ArrowRight} size={16} className="mr-2" />Mark as {formatStatus(canAdv)}
                          </DropdownMenuItem>
                        )}
                        {job.status !== "cancelled" && (
                          <DropdownMenuItem
                            disabled={isStatusPending}
                            className="text-muted-foreground"
                            onClick={() => onStatusChange(job.id, "cancelled")}
                          >
                            Cancel Job
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => { if (confirm("Delete this job?")) onDelete(job.id); }}
                        >
                          <Icon icon={Trash2} size={16} className="mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground">Showing {filtered.length} of {jobs.length} jobs</p>
      </div>
    </div>
  );
}
