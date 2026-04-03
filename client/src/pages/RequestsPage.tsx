import { useAutoCreate } from "@/hooks/useAutoCreate";
import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestsApi, customersApi } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Customer } from "@shared/schema";
import { cn, formatDate, formatStatus } from "@/lib/utils";
import {
  Plus, Search, Pencil, Trash2, MoreVertical, Inbox,
  Archive, CheckCircle2, CalendarClock, TrendingUp, X,
  FileText, Briefcase, User, MessageSquare, Globe,
  SlidersHorizontal, ExternalLink, ArrowRight, Phone,
  Mail, Clock, Tag, AlertTriangle, ChevronDown,
  CheckSquare,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { AddressSelector } from "@/components/AddressSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";

/* ─── types ──────────────────────────────────────────────────────────────── */
interface Request {
  id: number;
  title: string;
  description: string | null;
  customerId: number | null;
  serviceAddressId: number | null;
  priority: string;
  status: string;
  source: string;
  category: string | null;
  createdByUserId: number | null;
  ownerUserId: number | null;
  customerContactName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  preferredContactMethod: string | null;
  requestedDate: string | null;
  requestedTimeWindow: string | null;
  isFlexibleSchedule: boolean;
  clientNotes: string | null;
  internalNotes: string | null;
  convertedToType: string | null;
  convertedAt: string | null;
  convertedByUserId: number | null;
  createdAt: string;
}

interface StaffUser { id: number; name: string; email: string; role: string; }

/* ─── schema ─────────────────────────────────────────────────────────────── */
const createSchema = z.object({
  title:                z.string().min(1, "Title is required"),
  description:          z.string().optional(),
  customerId:           z.number({ coerce: true }).optional().nullable(),
  serviceAddressId:     z.number({ coerce: true }).optional().nullable(),
  priority:             z.string().default("normal"),
  source:               z.string().default("manual"),
  category:             z.string().optional(),
  customerContactName:  z.string().optional(),
  customerPhone:        z.string().optional(),
  customerEmail:        z.string().optional(),
  preferredContactMethod: z.string().optional().nullable(),
  requestedDate:        z.string().optional(),
  requestedTimeWindow:  z.string().optional(),
  isFlexibleSchedule:   z.boolean().default(false),
  clientNotes:          z.string().optional(),
  internalNotes:        z.string().optional(),
});

const editSchema = createSchema.extend({
  status:      z.string(),
  ownerUserId: z.number({ coerce: true }).optional().nullable(),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm   = z.infer<typeof editSchema>;

/* ─── constants ──────────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  new:                  { label: "New",                  cls: "bg-blue-100 text-blue-700" },
  triaged:              { label: "Triaged",              cls: "bg-yellow-100 text-yellow-700" },
  assessment_scheduled: { label: "Assessment Scheduled", cls: "bg-purple-100 text-purple-700" },
  converted:            { label: "Converted",            cls: "bg-emerald-100 text-emerald-700" },
  closed:               { label: "Closed",               cls: "bg-slate-100 text-slate-600" },
  archived:             { label: "Archived",             cls: "bg-muted/40 text-muted-foreground" },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  emergency: { label: "Emergency", cls: "bg-red-100 text-red-700" },
  high:      { label: "High",      cls: "bg-blue-100 text-blue-800" },
  normal:    { label: "Normal",    cls: "bg-muted/40 text-muted-foreground" },
  low:       { label: "Low",       cls: "bg-sky-50 text-sky-600" },
};

const SOURCE_LABELS: Record<string, string> = {
  manual:     "Manual",
  phone:      "Phone",
  sms:        "SMS",
  email:      "Email",
  web:        "Web",
  portal:     "Portal",
  technician: "Technician",
  other:      "Other",
};

const TIME_WINDOW_OPTIONS = [
  { value: "any_time",            label: "Any time" },
  { value: "morning_8_11",        label: "Morning (8–11 AM)" },
  { value: "late_morning_10_12",  label: "Late morning (10 AM–12 PM)" },
  { value: "afternoon_12_3",      label: "Afternoon (12–3 PM)" },
  { value: "late_afternoon_3_5",  label: "Late afternoon (3–5 PM)" },
  { value: "evening_5_7",         label: "Evening (5–7 PM)" },
  { value: "first_available",     label: "First available" },
  { value: "call_to_schedule",    label: "Call to schedule" },
] as const;

const TIME_WINDOW_LABELS: Record<string, string> = Object.fromEntries(
  TIME_WINDOW_OPTIONS.map(o => [o.value, o.label])
);

const TIME_WINDOW_VALUES = new Set(TIME_WINDOW_OPTIONS.map(o => o.value));

const ACTIVE_STATUSES = ["new", "triaged", "assessment_scheduled"] as const;
const TERMINAL_STATUSES = ["converted", "closed", "archived"] as const;

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: formatStatus(status), cls: "bg-muted/40 text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap", m.cls)}>
      {m.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const m = PRIORITY_META[priority] ?? { label: priority, cls: "bg-muted/40 text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap", m.cls)}>
      {m.label}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const label = SOURCE_LABELS[source] ?? source;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted/40 text-muted-foreground">
      {label}
    </span>
  );
}

function MetricCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: LucideIcon;
  color: "orange" | "blue" | "yellow" | "purple" | "green" | "slate";
}) {
  const colors = {
    orange: "bg-blue-500 text-white",
    blue:   "bg-blue-500 text-white",
    yellow: "bg-yellow-500 text-white",
    purple: "bg-purple-500 text-white",
    green:  "bg-emerald-500 text-white",
    slate:  "bg-muted-foreground/40 text-white",
  };
  return (
    <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3" style={{ boxShadow: "var(--shadow-low)" }}>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", colors[color])}>
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

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
        <span>{title}</span>
        <span className="flex-1 border-t border-border" />
      </p>
      {children}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{children}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export function RequestsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [, navigate] = useLocation();
  const toastErr = (title: string, err: unknown) =>
    toast({ title, description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });

  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editRequest, setEditRequest]   = useState<Request | null>(null);
  const [detail, setDetail]             = useState<Request | null>(null);

  /* queries */
  const { data: requests = [], isLoading } = useQuery<Request[]>({
    queryKey: ["/api/requests"],
    queryFn: requestsApi.getAll,
    refetchInterval: 60_000,
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: customersApi.getAll,
  });
  const { data: staffUsers = [] } = useQuery<StaffUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users").then(r => r.json()),
  });
  // Resolved downstream entity for the currently open converted request.
  const { data: convertedEntityRef } = useQuery<{ type: "estimate" | "job"; id: number }>({
    queryKey: ["/api/requests", detail?.id, "converted-entity"],
    queryFn: () => requestsApi.getConvertedEntity(detail!.id),
    enabled: detail?.status === "converted",
    staleTime: Infinity, // Immutable once set — a converted request maps to exactly one entity.
  });

  /* deep-link: ?id=X navigates here and auto-opens that request's detail sheet */
  const searchString = useSearch();
  useEffect(() => {
    if (!searchString || requests.length === 0 || detail) return;
    const params = new URLSearchParams(searchString);
    const deepId = Number(params.get("id"));
    if (!deepId) return;
    const match = requests.find(r => r.id === deepId);
    if (match) {
      setDetail(match);
      navigate("/requests", { replace: true });
    }
  }, [searchString, requests]);

  /* ── create form ──────────────────────────────────────────────────────── */
  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      priority: "normal",
      source:   "manual",
      isFlexibleSchedule: false,
    },
  });

  /* ── edit form ────────────────────────────────────────────────────────── */
  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  /* mutations */
  const createMutation = useMutation({
    mutationFn: (d: CreateForm) => requestsApi.create(d as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/requests"] }); closeDialog(); },
    onError: (err: unknown) => toastErr("Could not create request", err),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => requestsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/requests"] }); closeDialog(); },
    onError: (err: unknown) => toastErr("Could not update request", err),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => requestsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/requests"] }),
    onError: (err: unknown) => toastErr("Could not delete request", err),
  });
  const convertToEstimateMutation = useMutation({
    mutationFn: (id: number) => requestsApi.convertToEstimate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/requests"] });
      qc.invalidateQueries({ queryKey: ["/api/estimates"] });
      navigate("/estimates");
    },
    onError: (err: unknown) => toastErr("Could not convert to estimate", err),
  });
  const convertToJobMutation = useMutation({
    mutationFn: (id: number) => requestsApi.convertToJob(id),
    onSuccess: (data: { id: number }) => {
      qc.invalidateQueries({ queryKey: ["/api/requests"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      navigate(`/job/${data.id}`);
    },
    onError: (err: unknown) => toastErr("Could not convert to job", err),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => requestsApi.update(id, { status } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/requests"] }),
    onError: (err: unknown) => toastErr("Status update failed", err),
  });

  /* helpers */
  function openCreate() {
    setEditRequest(null);
    createForm.reset({ priority: "normal", source: "manual", isFlexibleSchedule: false });
    setDialogOpen(true);
  }
  useAutoCreate(openCreate);

  function openEdit(r: Request) {
    setEditRequest(r);
    editForm.reset({
      title:                r.title,
      description:          r.description ?? "",
      customerId:           r.customerId ?? undefined,
      serviceAddressId:     r.serviceAddressId ?? undefined,
      priority:             r.priority,
      status:               r.status,
      source:               r.source,
      category:             r.category ?? "",
      ownerUserId:          r.ownerUserId ?? undefined,
      customerContactName:  r.customerContactName ?? "",
      customerPhone:        r.customerPhone ?? "",
      customerEmail:        r.customerEmail ?? "",
      preferredContactMethod: r.preferredContactMethod ?? undefined,
      requestedDate:        r.requestedDate ? r.requestedDate.slice(0, 10) : "",
      requestedTimeWindow:  TIME_WINDOW_VALUES.has(r.requestedTimeWindow as any) ? (r.requestedTimeWindow ?? "") : "",
      isFlexibleSchedule:   r.isFlexibleSchedule,
      clientNotes:          r.clientNotes ?? "",
      internalNotes:        r.internalNotes ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditRequest(null);
    createForm.reset();
    editForm.reset();
  }

  function onCreateSubmit(data: CreateForm) {
    const payload = {
      ...data,
      customerId:           data.customerId || null,
      serviceAddressId:     data.serviceAddressId || null,
      requestedDate:        data.requestedDate || null,
      requestedTimeWindow:  data.requestedTimeWindow || null,
    };
    createMutation.mutate(payload as any);
  }

  function onEditSubmit(data: EditForm) {
    if (!editRequest) return;
    const payload = {
      ...data,
      customerId:           data.customerId || null,
      serviceAddressId:     data.serviceAddressId || null,
      ownerUserId:          data.ownerUserId || null,
      requestedDate:        data.requestedDate || null,
      requestedTimeWindow:  data.requestedTimeWindow || null,
    };
    updateMutation.mutate({ id: editRequest.id, data: payload });
  }

  /* derived */
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const newCount        = requests.filter(r => r.status === "new").length;
  const triagedCount    = requests.filter(r => r.status === "triaged").length;
  const assessmentCount = requests.filter(r => r.status === "assessment_scheduled").length;
  const convertedCount  = requests.filter(r => r.status === "converted").length;
  const newThisMonth    = requests.filter(r => new Date(r.createdAt) >= thisMonthStart).length;
  const conversionRate  = requests.length > 0 ? Math.round((convertedCount / requests.length) * 100) : 0;

  const filtered = requests.filter(r => {
    const customer = customers.find(c => c.id === r.customerId);
    const q = search.toLowerCase();
    const matchSearch = !search ||
      r.title.toLowerCase().includes(q) ||
      (customer?.name ?? "").toLowerCase().includes(q) ||
      (r.category ?? "").toLowerCase().includes(q);
    const matchStatus =
      filterStatus === "all"      ? true :
      filterStatus === "active"   ? ACTIVE_STATUSES.includes(r.status as any) :
      filterStatus === "archived_closed" ? (r.status === "archived" || r.status === "closed") :
      r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  function canConvert(r: Request) {
    return (
      ACTIVE_STATUSES.includes(r.status as any) &&
      r.customerId != null &&
      r.serviceAddressId != null
    );
  }

  function getUserName(id: number | null | undefined) {
    if (!id) return "—";
    return staffUsers.find(u => u.id === id)?.name ?? `User #${id}`;
  }

  /* ── icon color helper ────────────────────────────────────────────────── */
  function statusIconCls(status: string) {
    switch (status) {
      case "new":                  return { bg: "bg-blue-100",   icon: "text-blue-600" };
      case "triaged":              return { bg: "bg-yellow-100", icon: "text-yellow-600" };
      case "assessment_scheduled": return { bg: "bg-purple-100", icon: "text-purple-600" };
      case "converted":            return { bg: "bg-emerald-100",icon: "text-emerald-600" };
      default:                     return { bg: "bg-muted/40",   icon: "text-muted-foreground" };
    }
  }

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <Stack spacing={3}>

      {/* ── Metrics ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="New"            value={newCount}        icon={Inbox}         color="blue"   />
        <MetricCard label="Triaged"        value={triagedCount}    icon={CheckSquare}   color="yellow" />
        <MetricCard label="Assessment"     value={assessmentCount} icon={CalendarClock} color="purple" />
        <MetricCard label="Converted"      value={convertedCount}  icon={CheckCircle2}  color="green"  />
        <MetricCard label="Conversion Rate" value={`${conversionRate}%`} icon={ArrowRight} color="slate" sub={`${newThisMonth} new this month`} />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Icon icon={Search} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search requests..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-card"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <Icon icon={X} size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-44 text-sm bg-card">
              <Icon icon={SlidersHorizontal} size={14} className="mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active (all)</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="triaged">Triaged</SelectItem>
              <SelectItem value="assessment_scheduled">Assessment Scheduled</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="archived_closed">Archived / Closed</SelectItem>
              <SelectItem value="all">All Statuses</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={openCreate}
            className="h-8 bg-blue-500 hover:bg-blue-700 text-white text-sm px-3 whitespace-nowrap"
          >
            <Icon icon={Plus} size={14} className="mr-1.5" />
            New Request
          </Button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <Paper variant="outlined">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><Icon icon={Inbox} size={28} /></div>
            <p className="empty-state__title">
              {search || filterStatus !== "active" ? "No requests match your filters" : "No active requests"}
            </p>
            <p className="empty-state__desc">
              {search || filterStatus !== "active"
                ? "Try a different search term or clear the filters."
                : "Create your first request to start the intake workflow."}
            </p>
            {!search && filterStatus === "active" && (
              <Button onClick={openCreate} className="mt-4 h-8 bg-blue-500 hover:bg-blue-700 text-white text-sm">
                <Icon icon={Plus} size={14} className="mr-1.5" /> New Request
              </Button>
            )}
          </div>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Request</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Received</TableCell>
                    <TableCell padding="none" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(req => {
                    const customer = customers.find(c => c.id === req.customerId);
                    const { bg, icon } = statusIconCls(req.status);
                    const isTerminal = TERMINAL_STATUSES.includes(req.status as any);
                    return (
                      <TableRow
                        key={req.id}
                        hover
                        sx={{ cursor: "pointer" }}
                        onClick={() => setDetail(req)}
                      >
                        {/* Title */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0", bg)}>
                              <Icon icon={Inbox} size={13} className={icon} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{req.title}</p>
                              {req.category && (
                                <p className="text-xs text-muted-foreground truncate">{req.category}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {/* Client */}
                        <TableCell>
                          {customer ? (
                            <div className="flex items-center gap-1.5">
                              <Icon icon={User} size={12} className="text-muted-foreground/60 flex-shrink-0" />
                              <span className="text-sm text-foreground">{customer.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        {/* Status */}
                        <TableCell>
                          <StatusBadge status={req.status} />
                        </TableCell>
                        {/* Priority */}
                        <TableCell>
                          <PriorityBadge priority={req.priority} />
                        </TableCell>
                        {/* Date */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(req.createdAt)}</span>
                        </TableCell>
                        {/* Actions */}
                        <TableCell padding="none" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-7 h-7">
                                <Icon icon={MoreVertical} size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => setDetail(req)}>
                                <Icon icon={ExternalLink} size={16} className="mr-2" /> View Details
                              </DropdownMenuItem>
                              {!isTerminal && (
                                <DropdownMenuItem onClick={() => openEdit(req)}>
                                  <Icon icon={Pencil} size={16} className="mr-2" /> Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {canConvert(req) && (
                                <>
                                  <DropdownMenuItem
                                    disabled={convertToEstimateMutation.isPending || convertToJobMutation.isPending}
                                    onClick={() => convertToEstimateMutation.mutate(req.id)}
                                  >
                                    <Icon icon={FileText} size={16} className="mr-2" /> Convert to Estimate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={convertToEstimateMutation.isPending || convertToJobMutation.isPending}
                                    onClick={() => convertToJobMutation.mutate(req.id)}
                                  >
                                    <Icon icon={Briefcase} size={16} className="mr-2" /> Convert to Job
                                  </DropdownMenuItem>
                                </>
                              )}
                              {req.status === "new" && (
                                <DropdownMenuItem
                                  disabled={statusMutation.isPending}
                                  onClick={() => statusMutation.mutate({ id: req.id, status: "triaged" })}
                                >
                                  <Icon icon={CheckSquare} size={16} className="mr-2" /> Mark Triaged
                                </DropdownMenuItem>
                              )}
                              {(req.status === "new" || req.status === "triaged") && (
                                <DropdownMenuItem
                                  disabled={statusMutation.isPending}
                                  onClick={() => statusMutation.mutate({ id: req.id, status: "assessment_scheduled" })}
                                >
                                  <Icon icon={CalendarClock} size={16} className="mr-2" /> Schedule Assessment
                                </DropdownMenuItem>
                              )}
                              {!isTerminal && (
                                <>
                                  <DropdownMenuItem
                                    disabled={statusMutation.isPending}
                                    onClick={() => statusMutation.mutate({ id: req.id, status: "closed" })}
                                  >
                                    <Icon icon={X} size={16} className="mr-2" /> Close
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={statusMutation.isPending}
                                    onClick={() => statusMutation.mutate({ id: req.id, status: "archived" })}
                                  >
                                    <Icon icon={Archive} size={16} className="mr-2" /> Archive
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => { if (confirm(`Delete "${req.title}"?`)) deleteMutation.mutate(req.id); }}
                              >
                                <Icon icon={Trash2} size={16} className="mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <div className="px-4 py-2.5 border-t border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Showing {filtered.length} of {requests.length} requests
              </p>
            </div>
          </>
        )}
      </Paper>

      {/* ══════════════════════════════════════════════════════════════════
          REQUEST DETAIL SHEET
      ══════════════════════════════════════════════════════════════════ */}
      <Sheet open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg p-0 overflow-hidden flex flex-col bg-background">
          {detail && (() => {
            const req      = detail;
            const customer = customers.find(c => c.id === req.customerId);
            const isTerminal = TERMINAL_STATUSES.includes(req.status as any);
            const convertible = canConvert(req);
            const { bg, icon } = statusIconCls(req.status);
            return (
              <>
                {/* Header */}
                <div className="bg-card border-b border-border px-6 pt-5 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", bg)}>
                        <Icon icon={Inbox} size={18} className={icon} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-foreground leading-tight truncate">{req.title}</h2>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <StatusBadge status={req.status} />
                          <PriorityBadge priority={req.priority} />
                          <SourceBadge source={req.source} />
                        </div>
                      </div>
                    </div>
                    <button
                      className="text-muted-foreground hover:text-foreground transition-colors mt-1 flex-shrink-0"
                      onClick={() => setDetail(null)}
                    >
                      <Icon icon={X} size={20} />
                    </button>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    {convertible && (
                      <>
                        <Button
                          size="sm"
                          className="h-8 bg-blue-500 hover:bg-blue-700 text-white text-xs"
                          disabled={convertToEstimateMutation.isPending || convertToJobMutation.isPending}
                          onClick={() => { convertToEstimateMutation.mutate(req.id); setDetail(null); }}
                        >
                          <Icon icon={FileText} size={14} className="mr-1.5" /> Convert to Estimate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={convertToEstimateMutation.isPending || convertToJobMutation.isPending}
                          onClick={() => { convertToJobMutation.mutate(req.id); setDetail(null); }}
                        >
                          <Icon icon={Briefcase} size={14} className="mr-1.5" /> Convert to Job
                        </Button>
                      </>
                    )}
                    {!convertible && !isTerminal && (
                      <p className="text-xs text-muted-foreground italic">
                        {!req.customerId ? "Set a client" : "Set a service address"} to enable conversion.
                      </p>
                    )}
                    {!isTerminal && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs ml-auto"
                        onClick={() => { setDetail(null); openEdit(req); }}
                      >
                        <Icon icon={Pencil} size={14} className="mr-1.5" /> Edit
                      </Button>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                  {/* Description */}
                  {req.description && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Description</p>
                      <p className="text-sm text-foreground leading-relaxed">{req.description}</p>
                    </div>
                  )}

                  {/* Client */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Client</p>
                    <div className="bg-muted/40 rounded-lg border border-border">
                      {customer ? (
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                            {customer.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{customer.name}</p>
                            {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-sm text-muted-foreground">No client assigned</div>
                      )}
                    </div>
                  </div>

                  {/* Contact */}
                  {(req.customerContactName || req.customerPhone || req.customerEmail) && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Contact Info</p>
                      <div className="bg-muted/40 rounded-lg border border-border divide-y divide-border">
                        {req.customerContactName && <DetailRow label="Contact">{req.customerContactName}</DetailRow>}
                        {req.customerPhone && (
                          <DetailRow label="Phone">
                            <a href={`tel:${req.customerPhone}`} className="text-blue-700 hover:underline">{req.customerPhone}</a>
                          </DetailRow>
                        )}
                        {req.customerEmail && (
                          <DetailRow label="Email">
                            <a href={`mailto:${req.customerEmail}`} className="text-blue-700 hover:underline">{req.customerEmail}</a>
                          </DetailRow>
                        )}
                        {req.preferredContactMethod && <DetailRow label="Preferred">{req.preferredContactMethod.toUpperCase()}</DetailRow>}
                      </div>
                    </div>
                  )}

                  {/* Details */}
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Details</p>
                    <div className="bg-muted/40 rounded-lg border border-border divide-y divide-border">
                      <DetailRow label="Received">{formatDate(req.createdAt)}</DetailRow>
                      <DetailRow label="Source"><SourceBadge source={req.source} /></DetailRow>
                      {req.category && <DetailRow label="Category">{req.category}</DetailRow>}
                      <DetailRow label="Owner">{getUserName(req.ownerUserId)}</DetailRow>
                      {req.requestedDate && (
                        <DetailRow label="Requested Date">
                          {formatDate(req.requestedDate)}{req.requestedTimeWindow ? ` · ${TIME_WINDOW_LABELS[req.requestedTimeWindow] ?? req.requestedTimeWindow}` : ""}
                        </DetailRow>
                      )}
                      {req.isFlexibleSchedule && <DetailRow label="Schedule">Flexible</DetailRow>}
                    </div>
                  </div>

                  {/* Conversion info */}
                  {req.status === "converted" && req.convertedToType && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Conversion</p>
                      <div className="bg-emerald-50 rounded-lg border border-emerald-200 divide-y divide-emerald-200">
                        <DetailRow label="Converted to">
                          <span className="capitalize">{req.convertedToType}</span>
                        </DetailRow>
                        {req.convertedAt && <DetailRow label="Converted">{formatDate(req.convertedAt)}</DetailRow>}
                        {req.convertedByUserId && <DetailRow label="By">{getUserName(req.convertedByUserId)}</DetailRow>}
                      </div>
                      {convertedEntityRef && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 h-8 text-xs w-full"
                          onClick={() => {
                            setDetail(null);
                            navigate(convertedEntityRef.type === "job" ? `/job/${convertedEntityRef.id}` : "/estimates");
                          }}
                        >
                          <Icon icon={ArrowRight} size={14} className="mr-1.5" />
                          View {convertedEntityRef.type === "job" ? "Job" : "Estimate"}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Client Notes */}
                  {req.clientNotes && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Client Notes</p>
                      <div className="bg-muted/40 rounded-lg border border-border px-4 py-3">
                        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{req.clientNotes}</p>
                      </div>
                    </div>
                  )}

                  {/* Internal Notes */}
                  {req.internalNotes && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Internal Notes</p>
                      <div className="bg-amber-50 rounded-lg border border-amber-200 px-4 py-3">
                        <p className="text-sm text-amber-900 whitespace-pre-line leading-relaxed">{req.internalNotes}</p>
                      </div>
                    </div>
                  )}

                  {/* Quick actions */}
                  {!isTerminal && (
                    <div className="pt-2 border-t border-border space-y-2">
                      {/* Status progression */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {req.status === "new" && (
                          <Button variant="outline" size="sm" className="h-8 text-xs"
                            disabled={statusMutation.isPending}
                            onClick={() => { statusMutation.mutate({ id: req.id, status: "triaged" }); setDetail(prev => prev ? { ...prev, status: "triaged" } : null); }}>
                            <Icon icon={CheckSquare} size={14} className="mr-1.5" /> Mark Triaged
                          </Button>
                        )}
                        {(req.status === "new" || req.status === "triaged") && (
                          <Button variant="outline" size="sm" className="h-8 text-xs"
                            disabled={statusMutation.isPending}
                            onClick={() => { statusMutation.mutate({ id: req.id, status: "assessment_scheduled" }); setDetail(prev => prev ? { ...prev, status: "assessment_scheduled" } : null); }}>
                            <Icon icon={CalendarClock} size={14} className="mr-1.5" /> Schedule Assessment
                          </Button>
                        )}
                      </div>
                      {/* Terminal actions */}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs text-muted-foreground"
                          onClick={() => { statusMutation.mutate({ id: req.id, status: "closed" }); setDetail(null); }}>
                          <Icon icon={X} size={14} className="mr-1.5" /> Close
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs text-muted-foreground"
                          onClick={() => { statusMutation.mutate({ id: req.id, status: "archived" }); setDetail(null); }}>
                          <Icon icon={Archive} size={14} className="mr-1.5" /> Archive
                        </Button>
                        <Button variant="outline" size="sm"
                          className="h-8 text-xs text-destructive hover:text-destructive border-destructive/30 ml-auto"
                          onClick={() => { if (confirm(`Delete "${req.title}"?`)) { deleteMutation.mutate(req.id); setDetail(null); } }}>
                          <Icon icon={Trash2} size={14} className="mr-1.5" /> Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ══════════════════════════════════════════════════════════════════
          CREATE DIALOG (intake form — no status selector)
      ══════════════════════════════════════════════════════════════════ */}
      {dialogOpen && !editRequest && (
        <Dialog open onOpenChange={o => !o && closeDialog()} maxWidth="md" fullWidth>
          <DialogTitle onClose={closeDialog}>New Request</DialogTitle>
          <DialogContent>
            <form id="create-request-form" onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-5">

              {/* Core */}
              <FormSection title="Request">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Title <span className="text-destructive">*</span></Label>
                    <Input {...createForm.register("title")} placeholder="What does the client need?" className="h-9" />
                    {createForm.formState.errors.title && <p className="text-xs text-destructive">{createForm.formState.errors.title.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Description</Label>
                    <Textarea {...createForm.register("description")} rows={2} placeholder="More detail..." className="resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Priority</Label>
                      <Select value={createForm.watch("priority")} onValueChange={v => createForm.setValue("priority", v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="emergency">Emergency</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Category</Label>
                      <Input {...createForm.register("category")} placeholder="e.g. HVAC, Plumbing" className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Source</Label>
                    <Select value={createForm.watch("source")} onValueChange={v => createForm.setValue("source", v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="web">Web</SelectItem>
                        <SelectItem value="portal">Portal</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </FormSection>

              {/* Client */}
              <FormSection title="Client">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Client</Label>
                    <CustomerCombobox
                      customers={customers}
                      value={createForm.watch("customerId") ?? null}
                      onChange={id => { createForm.setValue("customerId", id ?? null); createForm.setValue("serviceAddressId", null); }}
                    />
                  </div>
                  <AddressSelector
                    customerId={createForm.watch("customerId")}
                    value={createForm.watch("serviceAddressId") ?? null}
                    onChange={id => createForm.setValue("serviceAddressId", id)}
                  />
                </div>
              </FormSection>

              {/* Contact */}
              <FormSection title="Contact Info">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Contact Name</Label>
                    <Input {...createForm.register("customerContactName")} placeholder="Name of person to contact" className="h-9" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Phone</Label>
                      <Input {...createForm.register("customerPhone")} placeholder="+1 555 000 0000" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Email</Label>
                      <Input {...createForm.register("customerEmail")} placeholder="email@example.com" className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Preferred Contact Method</Label>
                    <Select
                      value={createForm.watch("preferredContactMethod") ?? "_none"}
                      onValueChange={v => createForm.setValue("preferredContactMethod", v === "_none" ? null : v)}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Any</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </FormSection>

              {/* Scheduling */}
              <FormSection title="Scheduling">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Requested Date</Label>
                      <Input {...createForm.register("requestedDate")} type="date" className="h-9 w-full" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Time Window</Label>
                      <Select
                        value={createForm.watch("requestedTimeWindow") ?? ""}
                        onValueChange={v => createForm.setValue("requestedTimeWindow", v)}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Select time window" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_WINDOW_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="create-flexible"
                      checked={createForm.watch("isFlexibleSchedule")}
                      onCheckedChange={v => createForm.setValue("isFlexibleSchedule", !!v)}
                    />
                    <Label htmlFor="create-flexible" className="text-xs cursor-pointer">Schedule is flexible</Label>
                  </div>
                </div>
              </FormSection>

              {/* Notes */}
              <FormSection title="Notes">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Client Notes</Label>
                    <Textarea {...createForm.register("clientNotes")} rows={3} placeholder="Notes from the client..." className="resize-none" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Internal Notes
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(not visible to client)</span>
                    </Label>
                    <Textarea {...createForm.register("internalNotes")} rows={2} placeholder="Internal team notes..." className="resize-none" />
                  </div>
                </div>
              </FormSection>
            </form>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              type="submit"
              form="create-request-form"
              className="bg-blue-500 hover:bg-blue-700 text-white min-w-[120px]"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create Request"}
            </Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          EDIT DIALOG (triage form — includes status + owner)
      ══════════════════════════════════════════════════════════════════ */}
      {dialogOpen && editRequest && (
        <Dialog open onOpenChange={o => !o && closeDialog()} maxWidth="md" fullWidth>
          <DialogTitle onClose={closeDialog}>Edit Request</DialogTitle>
          <DialogContent>
            <form id="edit-request-form" onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-5">

              {/* Triage */}
              <FormSection title="Triage">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Status</Label>
                      <Select value={editForm.watch("status")} onValueChange={v => editForm.setValue("status", v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="triaged">Triaged</SelectItem>
                          <SelectItem value="assessment_scheduled">Assessment Scheduled</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Priority</Label>
                      <Select value={editForm.watch("priority")} onValueChange={v => editForm.setValue("priority", v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="emergency">Emergency</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Assign To</Label>
                    <Select
                      value={String(editForm.watch("ownerUserId") ?? "_none")}
                      onValueChange={v => editForm.setValue("ownerUserId", v === "_none" ? null : Number(v))}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Unassigned</SelectItem>
                        {staffUsers.filter(u => u.role === "admin" || u.role === "dispatcher").map(u => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </FormSection>

              {/* Request info */}
              <FormSection title="Request">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Title <span className="text-destructive">*</span></Label>
                    <Input {...editForm.register("title")} placeholder="What does the client need?" className="h-9" />
                    {editForm.formState.errors.title && <p className="text-xs text-destructive">{editForm.formState.errors.title.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Description</Label>
                    <Textarea {...editForm.register("description")} rows={2} placeholder="More detail..." className="resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Source</Label>
                      <Select value={editForm.watch("source")} onValueChange={v => editForm.setValue("source", v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="web">Web</SelectItem>
                          <SelectItem value="portal">Portal</SelectItem>
                          <SelectItem value="technician">Technician</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Category</Label>
                      <Input {...editForm.register("category")} placeholder="e.g. HVAC, Plumbing" className="h-9" />
                    </div>
                  </div>
                </div>
              </FormSection>

              {/* Client */}
              <FormSection title="Client">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Client</Label>
                    <CustomerCombobox
                      customers={customers}
                      value={editForm.watch("customerId") ?? null}
                      onChange={id => { editForm.setValue("customerId", id ?? null); editForm.setValue("serviceAddressId", null); }}
                    />
                  </div>
                  <AddressSelector
                    customerId={editForm.watch("customerId")}
                    value={editForm.watch("serviceAddressId") ?? null}
                    onChange={id => editForm.setValue("serviceAddressId", id)}
                  />
                </div>
              </FormSection>

              {/* Contact */}
              <FormSection title="Contact Info">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Contact Name</Label>
                    <Input {...editForm.register("customerContactName")} placeholder="Name of person to contact" className="h-9" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Phone</Label>
                      <Input {...editForm.register("customerPhone")} placeholder="+1 555 000 0000" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Email</Label>
                      <Input {...editForm.register("customerEmail")} placeholder="email@example.com" className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Preferred Contact Method</Label>
                    <Select
                      value={editForm.watch("preferredContactMethod") ?? "_none"}
                      onValueChange={v => editForm.setValue("preferredContactMethod", v === "_none" ? null : v)}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Any</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </FormSection>

              {/* Scheduling */}
              <FormSection title="Scheduling">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Requested Date</Label>
                      <Input {...editForm.register("requestedDate")} type="date" className="h-9 w-full" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Time Window</Label>
                      <Select
                        value={editForm.watch("requestedTimeWindow") ?? ""}
                        onValueChange={v => editForm.setValue("requestedTimeWindow", v)}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Select time window" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_WINDOW_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-flexible"
                      checked={editForm.watch("isFlexibleSchedule")}
                      onCheckedChange={v => editForm.setValue("isFlexibleSchedule", !!v)}
                    />
                    <Label htmlFor="edit-flexible" className="text-xs cursor-pointer">Schedule is flexible</Label>
                  </div>
                </div>
              </FormSection>

              {/* Notes */}
              <FormSection title="Notes">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Client Notes</Label>
                    <Textarea {...editForm.register("clientNotes")} rows={3} placeholder="Notes from the client..." className="resize-none" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Internal Notes
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(not visible to client)</span>
                    </Label>
                    <Textarea {...editForm.register("internalNotes")} rows={2} placeholder="Internal team notes..." className="resize-none" />
                  </div>
                </div>
              </FormSection>
            </form>
          </DialogContent>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              type="submit"
              form="edit-request-form"
              className="bg-blue-500 hover:bg-blue-700 text-white min-w-[120px]"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </Stack>
  );
}
