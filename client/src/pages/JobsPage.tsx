import { useAutoCreate } from "@/hooks/useAutoCreate";
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jobsApi, customersApi, techniciansApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import type { Job, Customer, Technician } from "@shared/schema";
import { cn, formatDateTime, formatStatus } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Plus, Search, MoreVertical, Pencil, Trash2, X,
  Briefcase, CheckCircle2, Clock, AlertCircle, User,
  MapPin, UserCheck, SlidersHorizontal,
  ArrowRight,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { jobFormSchema, JOB_FORM_DEFAULTS, mapJobToForm, buildJobPayload } from "@/components/jobs/jobForm";
import type { JobFormValues } from "@/components/jobs/jobForm";
import { JobFormFields } from "@/components/jobs/JobFormFields";

type TechWithUser = Technician & { user?: { id: number; name: string } };

/* ─── helpers ─────────────────────────────────────────────────────────────── */
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
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: formatStatus(status), cls: "bg-muted/40 text-muted-foreground" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap", m.cls)}>{m.label}</span>;
}
function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = { low: "bg-muted-foreground/40", normal: "bg-blue-500", high: "bg-orange-500", emergency: "bg-red-500" };
  return <span className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0", colors[priority] ?? "bg-muted-foreground/40")} />;
}
function MetricCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: LucideIcon;
  color: "yellow" | "orange" | "green" | "slate";
}) {
  const bg = { yellow: "bg-amber-500", orange: "bg-orange-500", green: "bg-emerald-500", slate: "bg-muted-foreground/40" }[color];
  return (
    <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3" style={{ boxShadow: "var(--shadow-low)" }}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-white", bg)}>
        <Icon icon={icon} size={17} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none mb-1">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export function JobsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const toastErr = (title: string, err: unknown) =>
    toast({ title, description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editJob, setEditJob]           = useState<Job | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const { data: jobs = [], isLoading }   = useQuery<Job[]>({ queryKey: ["/api/jobs"], queryFn: jobsApi.getAll, refetchInterval: 30_000 });
  const { data: customers = [] }         = useQuery<Customer[]>({ queryKey: ["/api/customers"], queryFn: customersApi.getAll });
  const { data: technicians = [] }       = useQuery<TechWithUser[]>({ queryKey: ["/api/technicians"], queryFn: techniciansApi.getAll });

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: JOB_FORM_DEFAULTS,
    values: editJob ? mapJobToForm(editJob) : undefined,
  });
  const { handleSubmit, reset } = form;

  const createMutation  = useMutation({ mutationFn: (d: any) => jobsApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/jobs"] }); qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }); closeDialog(); }, onError: (err: Error) => toastErr("Could not create job", err) });
  const updateMutation  = useMutation({ mutationFn: ({ id, data }: any) => jobsApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/jobs"] }); qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }); closeDialog(); }, onError: (err: Error) => toastErr("Could not save job", err) });
  const deleteMutation  = useMutation({ mutationFn: (id: number) => jobsApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/jobs"] }), onError: (err: Error) => toastErr("Could not delete job", err) });
  const statusMutation  = useMutation({ mutationFn: ({ id, status }: any) => jobsApi.update(id, { status }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/jobs"] }); qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }); }, onError: (err: Error) => toastErr("Status update failed", err) });

  function openCreate() { setEditJob(null); reset(JOB_FORM_DEFAULTS); setSelectedAddressId(null); setDialogOpen(true); }
  useAutoCreate(openCreate);
  function openEdit(job: Job) { setEditJob(job); reset(mapJobToForm(job)); setSelectedAddressId(null); setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditJob(null); reset(JOB_FORM_DEFAULTS); setSelectedAddressId(null); }
  const onSubmit = (data: JobFormValues) => {
    const payload = buildJobPayload(data, { isCreate: !editJob });
    if (editJob) updateMutation.mutate({ id: editJob.id, data: payload });
    else createMutation.mutate(payload);
  };

  /* derived */
  const nextStatus: Record<string, string> = { pending: "assigned", assigned: "in_progress", in_progress: "completed" };
  const pendingCount    = jobs.filter(j => j.status === "pending").length;
  const inProgressCount = jobs.filter(j => ["in_progress","assigned"].includes(j.status)).length;
  const completedCount  = jobs.filter(j => j.status === "completed").length;
  const cancelledCount  = jobs.filter(j => j.status === "cancelled").length;

  const filtered = jobs.filter(j => {
    return (!search || j.title.toLowerCase().includes(search.toLowerCase()))
      && (filterStatus === "all" || j.status === filterStatus)
      && (filterPriority === "all" || j.priority === filterPriority);
  });

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Pending"     value={pendingCount}    icon={Clock}         color="yellow" />
        <MetricCard label="In Progress" value={inProgressCount} icon={Briefcase}     color="orange" />
        <MetricCard label="Completed"   value={completedCount}  icon={CheckCircle2}  color="green"  />
        <MetricCard label="Cancelled"   value={cancelledCount}  icon={AlertCircle}   color="slate"  />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Icon icon={Search} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search jobs…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-card" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><Icon icon={X} size={14} /></button>}
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-36 text-sm bg-card">
            <Icon icon={SlidersHorizontal} size={14} className="mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="h-8 w-36 text-sm bg-card">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="ml-auto h-8 bg-orange-500 hover:bg-orange-600 text-white text-sm px-3">
          <Icon icon={Plus} size={14} className="mr-1.5" /> New Job
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-low)" }}>
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><Icon icon={Briefcase} size={28} /></div>
            <p className="empty-state__title">{search || filterStatus !== "all" ? "No jobs match your filters" : "No jobs yet"}</p>
            <p className="empty-state__desc">{search || filterStatus !== "all" ? "Try different search terms or clear filters." : "Create your first job to get started."}</p>
            {!search && filterStatus === "all" && <Button onClick={openCreate} className="mt-4 h-8 bg-orange-500 hover:bg-orange-600 text-white text-sm"><Icon icon={Plus} size={14} className="mr-1.5" />New Job</Button>}
          </div>
        ) : (
          <>
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
                      <tr key={job.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30 cursor-pointer group transition-colors" onClick={() => navigate(`/job/${job.id}`)}>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="font-mono text-xs text-muted-foreground">{job.jobNumber ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground truncate max-w-[200px]">{job.title}</p>
                          {job.address && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate max-w-[200px]"><Icon icon={MapPin} size={12} className="flex-shrink-0" />{job.address}</p>}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {customer ? <div className="flex items-center gap-1.5"><Icon icon={User} size={12} className="text-muted-foreground/60" /><span className="text-sm text-foreground">{customer.name}</span></div> : <span className="text-sm text-muted-foreground">—</span>}
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
                              <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"><Icon icon={MoreVertical} size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => navigate(`/job/${job.id}`)}>View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(job)}><Icon icon={Pencil} size={16} className="mr-2" />Edit</DropdownMenuItem>
                              {canAdv && <DropdownMenuItem disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: job.id, status: canAdv })}><Icon icon={ArrowRight} size={16} className="mr-2" />Mark as {formatStatus(canAdv)}</DropdownMenuItem>}
                              {job.status !== "cancelled" && <DropdownMenuItem disabled={statusMutation.isPending} className="text-muted-foreground" onClick={() => statusMutation.mutate({ id: job.id, status: "cancelled" })}>Cancel Job</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { if (confirm("Delete this job?")) deleteMutation.mutate(job.id); }}><Icon icon={Trash2} size={16} className="mr-2" />Delete</DropdownMenuItem>
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
          </>
        )}
      </div>

      {/* ── Create / Edit Dialog — two-panel Jobber layout ── */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-4xl w-full p-0 gap-0 bg-background overflow-hidden flex flex-col mx-2 sm:mx-auto" style={{ maxHeight: "92vh" }}>
          <DialogDescription className="sr-only">Create or edit a job</DialogDescription>
          <DialogHeader className="px-6 py-4 bg-card border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold">
                {editJob ? `Edit Job ${editJob.jobNumber ?? `#${editJob.id}`}` : "New Job"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={closeDialog}>Cancel</Button>
                <Button
                  size="sm"
                  className="h-8 bg-orange-500 hover:bg-orange-600 text-white min-w-[100px]"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  onClick={handleSubmit(onSubmit)}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving…" : editJob ? "Save Changes" : "Create Job"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-4 max-w-xl mx-auto">
              <JobFormFields
                form={form}
                customers={customers}
                technicians={technicians}
                showStatus={!!editJob}
                selectedAddressId={selectedAddressId}
                onAddressIdChange={(id, _addr) => setSelectedAddressId(id)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
