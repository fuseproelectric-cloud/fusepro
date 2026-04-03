import { useAutoCreate } from "@/hooks/useAutoCreate";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { customersApi, jobsApi, estimatesApi, invoicesApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Job } from "@shared/schema";
import { cn, formatDate, formatStatus, STATUS_COLORS } from "@/lib/utils";
import {
  Plus, Search, Pencil, Trash2, MoreVertical, Users, X,
  Phone, Mail, MapPin, Building2, Tag, FileText, Receipt,
  Briefcase, ChevronRight, Star, UserPlus, TrendingUp,
  CalendarDays, ExternalLink, SlidersHorizontal, ArrowUpDown,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { TextInput, TextareaInput, FormSection, FormRow, FormActions } from "@/components/forms";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ─── schema ─────────────────────────────────────────────────────────────── */
const customerSchema = z.object({
  name:       z.string().min(1, "Name is required"),
  company:    z.string().optional(),
  email:      z.string().email("Invalid email").optional().or(z.literal("")),
  phone:      z.string().optional(),
  notes:      z.string().optional(),
  tags:       z.string().optional(),
  leadSource: z.string().optional(),
});
type CustomerForm = z.infer<typeof customerSchema>;

const addressSchema = z.object({
  label:   z.string().min(1, "Label is required"),
  address: z.string().optional(),
  city:    z.string().optional(),
  state:   z.string().optional(),
  zip:     z.string().optional(),
  notes:   z.string().optional(),
  isPrimary: z.boolean().optional(),
});
type AddressForm = z.infer<typeof addressSchema>;

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
function avatarColor(name: string) {
  const palette = [
    "bg-blue-100 text-blue-700",
    "bg-blue-100 text-blue-600",
    "bg-emerald-100 text-emerald-600",
    "bg-purple-100 text-purple-600",
    "bg-rose-100 text-rose-600",
    "bg-amber-100 text-amber-600",
    "bg-cyan-100 text-cyan-600",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

/* ─── subcomponents ───────────────────────────────────────────────────────── */
function MetricCard({ label, value, sub, icon, accent = false }: {
  label: string; value: string | number; sub?: string;
  icon: LucideIcon; accent?: boolean;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3" style={{ boxShadow: "var(--shadow-low)" }}>
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
        accent ? "bg-blue-500" : "bg-muted"
      )}>
        <Icon icon={icon} size={17} className={cn(accent ? "text-white" : "text-muted-foreground")} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground leading-none mb-1">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export function CustomersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const toastErr = (title: string, err: unknown) =>
    toast({ title, description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });
  const [, navigate] = useLocation();
  const [search, setSearch]             = useState("");
  const [sortBy, setSortBy]             = useState<"name" | "createdAt">("name");
  const [tagFilter, setTagFilter]       = useState("all");
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  /* queries */
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: customersApi.getAll,
    refetchInterval: 60_000,
  });
  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    queryFn: jobsApi.getAll,
  });
  const { data: allEstimates = [] } = useQuery<any[]>({
    queryKey: ["/api/estimates"],
    queryFn: estimatesApi.getAll,
  });
  const { data: allInvoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    queryFn: invoicesApi.getAll,
  });

  /* form */
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    values: editCustomer ? {
      name:       editCustomer.name,
      company:    editCustomer.company ?? "",
      email:      editCustomer.email ?? "",
      phone:      editCustomer.phone ?? "",
      notes:      editCustomer.notes ?? "",
      tags:       (editCustomer.tags ?? []).join(", "),
      leadSource: editCustomer.leadSource ?? "",
    } : undefined,
  });

  /* mutations */
  const createMutation = useMutation({
    mutationFn: (data: CustomerForm) => customersApi.create({
      ...data,
      tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/customers"] }); closeDialog(); },
    onError: (err: unknown) => toastErr("Could not create customer", err),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => customersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/customers"] }); closeDialog(); },
    onError: (err: unknown) => toastErr("Could not update customer", err),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => customersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/customers"] }),
    onError: (err: unknown) => toastErr("Could not delete customer", err),
  });

  /* helpers */
  function openCreate() {
    setEditCustomer(null);
    reset({});
    setDialogOpen(true);
  }
  useAutoCreate(openCreate);
  function openEdit(c: Customer) {
    setEditCustomer(c);
    reset({
      name:       c.name,
      company:    c.company ?? "",
      email:      c.email ?? "",
      phone:      c.phone ?? "",
      notes:      c.notes ?? "",
      tags:       (c.tags ?? []).join(", "),
      leadSource: c.leadSource ?? "",
    });
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
    setEditCustomer(null);
    reset();
  }
  const onSubmit = (data: CustomerForm) => {
    const tags = data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const payload = { ...data, tags } as any;
    if (editCustomer) updateMutation.mutate({ id: editCustomer.id, data: payload });
    else createMutation.mutate(payload);
  };

  /* derived data */
  const allTags = useMemo(() => {
    const set = new Set<string>();
    customers.forEach(c => (c.tags ?? []).forEach((t: string) => set.add(t)));
    return Array.from(set).sort();
  }, [customers]);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = customers.filter(c => new Date(c.createdAt) >= thisMonthStart).length;
  const withJobs     = new Set(allJobs.map(j => j.customerId)).size;
  const activeCount  = customers.filter(c =>
    allJobs.some(j => j.customerId === c.id && ["scheduled", "in_progress"].includes(j.status))
  ).length;

  const filtered = useMemo(() => {
    let list = customers.filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.company ?? "").toLowerCase().includes(q)
      );
    });
    if (tagFilter !== "all") list = list.filter(c => (c.tags ?? []).includes(tagFilter));
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [customers, search, tagFilter, sortBy]);

  const getJobs      = (id: number) => allJobs.filter(j => j.customerId === id);
  const getEstimates = (id: number) => allEstimates.filter(e => e.customerId === id);
  const getInvoices  = (id: number) => allInvoices.filter(i => i.customerId === id);

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <Stack spacing={3}>

      {/* ── Metrics bar ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Clients"    value={customers.length} icon={Users}         accent />
        <MetricCard label="New This Month"   value={newThisMonth}     icon={UserPlus}       sub={`of ${customers.length} total`} />
        <MetricCard label="Currently Active" value={activeCount}      icon={TrendingUp}     sub="scheduled or in progress" />
        <MetricCard label="Have Jobs"        value={withJobs}         icon={Briefcase}      sub="at least one job" />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Icon icon={Search} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search clients..."
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

        {/* Tag filter */}
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="h-8 w-36 text-sm bg-card">
            <Icon icon={SlidersHorizontal} size={14} className="mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className="h-8 w-36 text-sm bg-card">
            <Icon icon={ArrowUpDown} size={14} className="mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="createdAt">Recently Added</SelectItem>
          </SelectContent>
        </Select>

        <Button
          onClick={openCreate}
          className="ml-auto h-8 bg-blue-500 hover:bg-blue-700 text-white text-sm px-3"
        >
          <Icon icon={Plus} size={14} className="mr-1.5" />
          New Client
        </Button>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <Paper variant="outlined">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <Icon icon={Users} size={28} />
            </div>
            <p className="empty-state__title">
              {search || tagFilter !== "all" ? "No clients match your filters" : "No clients yet"}
            </p>
            <p className="empty-state__desc">
              {search || tagFilter !== "all"
                ? "Try a different search term or clear the filters."
                : "Add your first client to get started."}
            </p>
            {!search && tagFilter === "all" && (
              <Button onClick={openCreate} className="mt-4 h-8 bg-blue-500 hover:bg-blue-700 text-white text-sm">
                <Icon icon={Plus} size={14} className="mr-1.5" /> New Client
              </Button>
            )}
          </div>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Tags</TableCell>
                    <TableCell align="center">Jobs</TableCell>
                    <TableCell>Added</TableCell>
                    <TableCell padding="none" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((c) => {
                    const jobs = getJobs(c.id);
                    const tags = c.tags ?? [] as string[];
                    const activeJob = jobs.find(j => ["scheduled","in_progress"].includes(j.status));
                    return (
                      <TableRow
                        key={c.id}
                        hover
                        sx={{ cursor: "pointer" }}
                        onClick={() => navigate(`/customers/${c.id}`)}
                      >
                        {/* Client name + avatar */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0", avatarColor(c.name))}>
                              {getInitials(c.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground truncate">{c.name}</span>
                                {activeJob && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                                    Active
                                  </span>
                                )}
                              </div>
                              {c.company && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                  <Icon icon={Building2} size={12} className="flex-shrink-0" />
                                  {c.company}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {/* Contact */}
                        <TableCell>
                          <div className="space-y-0.5">
                            {c.phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Icon icon={Phone} size={12} className="text-muted-foreground/60 flex-shrink-0" />
                                {c.phone}
                              </p>
                            )}
                            {c.email && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate max-w-[180px]">
                                <Icon icon={Mail} size={12} className="text-muted-foreground/60 flex-shrink-0" />
                                {c.email}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        {/* Location */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground">—</span>
                        </TableCell>
                        {/* Tags */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((tag: string) => (
                              <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                                {tag}
                              </span>
                            ))}
                            {tags.length > 3 && (
                              <span className="text-[10px] text-muted-foreground/60">+{tags.length - 3}</span>
                            )}
                          </div>
                        </TableCell>
                        {/* Jobs count */}
                        <TableCell align="center">
                          <span className={cn(
                            "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold",
                            jobs.length > 0 ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground"
                          )}>
                            {jobs.length}
                          </span>
                        </TableCell>
                        {/* Added */}
                        <TableCell>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.createdAt)}</span>
                        </TableCell>
                        {/* Actions */}
                        <TableCell padding="none" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-7 h-7">
                                <Icon icon={MoreVertical} size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => navigate(`/customers/${c.id}`)}>
                                <Icon icon={ExternalLink} size={16} className="mr-2" /> View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(c)}>
                                <Icon icon={Pencil} size={16} className="mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => { if (confirm(`Delete ${c.name}?`)) deleteMutation.mutate(c.id); }}
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
                Showing {filtered.length} of {customers.length} clients
              </p>
            </div>
          </>
        )}
      </Paper>


      {/* ══════════════════════════════════════════════════════════════════
          NEW / EDIT CLIENT DIALOG — Jobber-style form sections
      ══════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && closeDialog()} maxWidth="md" fullWidth>
        <DialogTitle onClose={closeDialog}>{editCustomer ? "Edit Client" : "New Client"}</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <FormSection title="Client Name">
              <FormRow cols={2}>
                <TextInput label="Full Name" required placeholder="John Smith"       error={errors.name}  {...register("name")} />
                <TextInput label="Company"              placeholder="Business name"                        {...register("company")} />
              </FormRow>
            </FormSection>
            <FormSection title="Contact Info">
              <FormRow cols={2}>
                <TextInput label="Phone" placeholder="(555) 555-5555"                                     {...register("phone")} />
                <TextInput label="Email" type="email" placeholder="john@example.com" error={errors.email} {...register("email")} />
              </FormRow>
            </FormSection>
            <FormSection title="Additional Info">
              <FormRow cols={2}>
                <TextInput label="Lead Source" placeholder="Referral, Google, Yelp"         {...register("leadSource")} />
                <TextInput label="Tags"        placeholder="residential, vip"  hint="Comma-separated" {...register("tags")} />
              </FormRow>
            </FormSection>
            <FormSection title="Notes">
              <TextareaInput label="" rows={3} placeholder="Add any notes about this client for your team..." {...register("notes")} />
            </FormSection>
            <FormActions
              submitLabel={editCustomer ? "Save Changes" : "Create Client"}
              loading={createMutation.isPending || updateMutation.isPending}
              onCancel={closeDialog}
            />
          </form>
        </DialogContent>
      </Dialog>

    </Stack>
  );
}
