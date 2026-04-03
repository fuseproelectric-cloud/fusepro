import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { customersApi, jobsApi, estimatesApi, invoicesApi, techniciansApi } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  MapPin, Pencil, Trash2, Plus, Briefcase,
  FileText, Receipt, ChevronRight, Phone, Mail, Building2, Lock,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormActions } from "@/components/forms";
import { jobFormSchema, buildJobPayload } from "@/components/jobs/jobForm";
import type { JobFormValues } from "@/components/jobs/jobForm";
import { JobFormFields } from "@/components/jobs/JobFormFields";
import type { Technician } from "@shared/schema";
import Stack from "@mui/material/Stack";

type CustomerAddress = {
  id: number; customerId: number; label: string;
  address: string | null; city: string | null; state: string | null;
  zip: string | null; isPrimary: boolean; notes: string | null; createdAt: string;
};

const addressSchema = z.object({
  label:     z.string().optional(),
  address:   z.string().min(1, "Street address is required"),
  city:      z.string().min(1, "City is required"),
  state:     z.string().min(1, "State is required"),
  zip:       z.string().min(1, "ZIP is required"),
  notes:     z.string().optional(),
  isPrimary: z.boolean().optional(),
});
type AddressForm = z.infer<typeof addressSchema>;

type TechWithUser = Technician & { user?: { id: number; name: string } };

const estimateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  notes: z.string().optional(),
});
type EstimateForm = z.infer<typeof estimateSchema>;

const invoiceSchema = z.object({
  subject:      z.string().optional(),
  paymentTerms: z.string().optional(),
  notes:        z.string().optional(),
});
type InvoiceForm = z.infer<typeof invoiceSchema>;

const JOB_STATUS: Record<string, { label: string; cls: string }> = {
  pending:     { label: "Pending",     cls: "bg-slate-100 text-slate-600" },
  assigned:    { label: "Assigned",    cls: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress", cls: "bg-blue-100 text-blue-800" },
  scheduled:   { label: "Scheduled",   cls: "bg-purple-100 text-purple-700" },
  completed:   { label: "Completed",   cls: "bg-emerald-100 text-emerald-700" },
  cancelled:   { label: "Cancelled",   cls: "bg-red-100 text-red-600" },
};
const EST_STATUS: Record<string, { label: string; cls: string }> = {
  draft:              { label: "Draft",              cls: "bg-slate-100 text-slate-600" },
  awaiting_response:  { label: "Awaiting Response",  cls: "bg-amber-100 text-amber-700" },
  changes_requested:  { label: "Changes Requested",  cls: "bg-amber-100 text-amber-700" },
  approved:           { label: "Approved",           cls: "bg-emerald-100 text-emerald-700" },
  converted:          { label: "Converted",          cls: "bg-blue-100 text-blue-700" },
  archived:           { label: "Archived",           cls: "bg-muted/40 text-muted-foreground" },
};
const INV_STATUS: Record<string, { label: string; cls: string }> = {
  draft:   { label: "Draft",   cls: "bg-slate-100 text-slate-600" },
  sent:    { label: "Sent",    cls: "bg-blue-100 text-blue-700" },
  paid:    { label: "Paid",    cls: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "Overdue", cls: "bg-red-100 text-red-600" },
};

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; cls: string }> }) {
  const m = map[status] ?? { label: status, cls: "bg-muted/40 text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap", m.cls)}>
      {m.label}
    </span>
  );
}

export function CustomerAddressPage() {
  const { id, addrId } = useParams<{ id: string; addrId: string }>();
  const customerId = parseInt(id ?? "0");
  const addressId  = parseInt(addrId ?? "0");
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const toastErr = (title: string, err: unknown) =>
    toast({ title, description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });

  const [editOpen,    setEditOpen]    = useState(false);
  const [jobOpen,     setJobOpen]     = useState(false);
  const [estOpen,     setEstOpen]     = useState(false);
  const [invOpen,     setInvOpen]     = useState(false);

  /* ── queries ── */
  const { data: customer, isLoading: custLoading } = useQuery<any>({
    queryKey: ["/api/customers", customerId],
    queryFn: () => customersApi.getById(customerId),
    enabled: !!customerId,
  });
  const { data: addresses = [], isLoading: addrLoading } = useQuery<CustomerAddress[]>({
    queryKey: ["/api/customers", customerId, "addresses"],
    queryFn: () => customersApi.getAddresses(customerId),
    enabled: !!customerId,
  });
  const { data: allJobs = [] } = useQuery<any[]>({
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
  const { data: technicians = [] } = useQuery<TechWithUser[]>({
    queryKey: ["/api/technicians"],
    queryFn: techniciansApi.getAll,
  });

  const addr          = addresses.find(a => a.id === addressId);
  const custJobs      = allJobs.filter(j => j.customerId === customerId);
  const custEstimates = allEstimates.filter(e => e.customerId === customerId);
  const custInvoices  = allInvoices.filter(i => i.customerId === customerId);
  const outstanding   = custInvoices
    .filter(i => ["sent", "overdue"].includes(i.status))
    .reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);

  /* ── forms ── */
  const form    = useForm<AddressForm>({ resolver: zodResolver(addressSchema) });
  const jobForm = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title: "", description: "", instructions: "", notes: "",
      customerId: null, technicianId: null,
      status: "pending", priority: "normal",
      dateStr: "", timeStr: "", endTimeStr: "",
      address: "", city: "", state: "", zip: "",
    },
  });
  const estForm = useForm<EstimateForm>({ resolver: zodResolver(estimateSchema) });
  const invForm = useForm<InvoiceForm>({ resolver: zodResolver(invoiceSchema) });

  /* ── mutations ── */
  const updateMutation = useMutation({
    mutationFn: (data: AddressForm) => customersApi.updateAddress(customerId, addressId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/customers", customerId, "addresses"] });
      setEditOpen(false);
    },
    onError: (err: unknown) => toastErr("Could not update address", err),
  });
  const deleteMutation = useMutation({
    mutationFn: () => customersApi.deleteAddress(customerId, addressId),
    onSuccess: () => navigate(`/customers/${customerId}`),
    onError: (err: unknown) => toastErr("Could not delete address", err),
  });

  const fullAddress = addr
    ? [addr.address, addr.city, addr.state, addr.zip].filter(Boolean).join(", ")
    : "";

  const createJobMutation = useMutation({
    mutationFn: (data: JobFormValues) => jobsApi.create(
      buildJobPayload(data, {
        isCreate: true,
        lockedCustomerId: customerId,
        lockedAddress: addr ? { address: addr.address, city: addr.city, state: addr.state, zip: addr.zip } : null,
      }) as any
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setJobOpen(false);
      jobForm.reset();
    },
    onError: (err: unknown) => toastErr("Could not create job", err),
  });

  const createEstMutation = useMutation({
    mutationFn: (data: EstimateForm) => estimatesApi.create({ ...data, customerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/estimates"] });
      setEstOpen(false);
      estForm.reset();
    },
    onError: (err: unknown) => toastErr("Could not create estimate", err),
  });

  const createInvMutation = useMutation({
    mutationFn: (data: InvoiceForm) => invoicesApi.create({ ...data, customerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      setInvOpen(false);
      invForm.reset();
    },
    onError: (err: unknown) => toastErr("Could not create invoice", err),
  });

  const [watchedCity,  setWatchedCity]  = useState("");
  const [watchedState, setWatchedState] = useState("");
  const [watchedZip,   setWatchedZip]   = useState("");

  function openEdit() {
    if (!addr) return;
    setWatchedCity(addr.city ?? "");
    setWatchedState(addr.state ?? "");
    setWatchedZip(addr.zip ?? "");
    form.reset({
      label: addr.label, address: addr.address ?? "", city: addr.city ?? "",
      state: addr.state ?? "", zip: addr.zip ?? "", notes: addr.notes ?? "",
      isPrimary: addr.isPrimary,
    });
    setEditOpen(true);
  }

  /* ── loading ── */
  if (custLoading || addrLoading) {
    return (
      <Stack spacing={3}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </Stack>
    );
  }
  if (!addr || !customer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Address not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(`/customers/${customerId}`)}>
          Back to Client
        </Button>
      </div>
    );
  }

  return (
    <Stack spacing={3}>

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate("/customers")} className="hover:text-foreground transition-colors">
          All Clients
        </button>
        <Icon icon={ChevronRight} size={14} />
        <button onClick={() => navigate(`/customers/${customerId}`)} className="hover:text-foreground transition-colors flex items-center gap-1">
          <Icon icon={Building2} size={14} />
          {customer.name}
        </button>
        <Icon icon={ChevronRight} size={14} />
        <span className="text-foreground font-medium">{addr.label}</span>
      </div>

      {/* ── Address Header Card ── */}
      <div className="bg-card rounded-xl border border-border" style={{ boxShadow: "var(--shadow-low)" }}>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0",
                addr.isPrimary ? "bg-blue-500" : "bg-muted"
              )}>
                <Icon icon={MapPin} size={28} className={cn(addr.isPrimary ? "text-white" : "text-muted-foreground")} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">{addr.label}</h1>
                  {addr.isPrimary && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                      Primary
                    </span>
                  )}
                </div>
                {(addr.address || addr.city) && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent([addr.address, addr.city, addr.state, addr.zip].filter(Boolean).join(", "))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-1 hover:text-blue-500 transition-colors"
                  >
                    {addr.address && <p className="text-base text-muted-foreground">{addr.address}</p>}
                    {(addr.city || addr.state || addr.zip) && (
                      <p className="text-base text-muted-foreground">
                        {[addr.city, addr.state, addr.zip].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </a>
                )}
                {addr.notes && (
                  <p className="text-sm text-muted-foreground/70 italic mt-1">{addr.notes}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={openEdit} variant="outline" className="h-9">
                <Icon icon={Pencil} size={14} className="mr-1.5" /> Edit
              </Button>
              <Button
                variant="outline"
                className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => { if (confirm("Delete this address?")) deleteMutation.mutate(); }}
              >
                <Icon icon={Trash2} size={14} className="mr-1.5" /> Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Client info bar */}
        <div className="border-t border-border bg-muted/30 px-6 py-3 flex flex-wrap items-center gap-4 rounded-b-xl">
          <button
            onClick={() => navigate(`/customers/${customerId}`)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-blue-500 transition-colors"
          >
            <Icon icon={Building2} size={16} className="text-muted-foreground" />
            {customer.name}
            {customer.company && <span className="text-muted-foreground font-normal">· {customer.company}</span>}
          </button>
          {customer.phone && (
            <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Icon icon={Phone} size={14} /> {customer.phone}
            </a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Icon icon={Mail} size={14} /> {customer.email}
            </a>
          )}
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="bg-blue-500 hover:bg-blue-700 text-white h-9"
          onClick={() => setJobOpen(true)}
        >
          <Icon icon={Plus} size={14} className="mr-1.5" /> New Job
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9"
          onClick={() => setEstOpen(true)}
        >
          <Icon icon={Plus} size={14} className="mr-1.5" /> New Estimate
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9"
          onClick={() => setInvOpen(true)}
        >
          <Icon icon={Plus} size={14} className="mr-1.5" /> New Invoice
        </Button>
      </div>

      {/* ── Tabs: Jobs / Estimates / Invoices ── */}
      <Tabs defaultValue="jobs">
        <TabsList className="h-10 bg-card border border-border rounded-lg p-1 gap-1">
          {[
            { val: "jobs",      icon: Briefcase, label: "Jobs",      count: custJobs.length },
            { val: "estimates", icon: FileText,  label: "Estimates", count: custEstimates.length },
            { val: "invoices",  icon: Receipt,   label: "Invoices",  count: custInvoices.length },
          ].map(tab => (
            <TabsTrigger
              key={tab.val}
              value={tab.val}
              className="h-8 px-4 rounded-md text-sm font-medium data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-none text-muted-foreground gap-2"
            >
              <Icon icon={tab.icon} size={14} />
              {tab.label}
              <span className={cn(
                "inline-flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full text-[10px] font-bold",
                "bg-current/10"
              )}>
                {tab.count}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Jobs */}
        <TabsContent value="jobs" className="mt-4">
          {custJobs.length === 0 ? (
            <div className="bg-card rounded-xl border border-dashed border-border p-12 text-center">
              <Icon icon={Briefcase} size={48} className="text-muted-foreground/25 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No jobs yet</p>
              <button
                type="button"
                onClick={() => setJobOpen(true)}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium"
              >
                + Create first job
              </button>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-low)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Job</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Status</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Date</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {custJobs.map((j: any) => (
                    <tr
                      key={j.id}
                      onClick={() => navigate(`/job/${j.id}`)}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{j.title}</p>
                        {j.jobNumber && <p className="text-xs text-muted-foreground">#{j.jobNumber}</p>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <StatusBadge status={j.status} map={JOB_STATUS} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {j.scheduledAt ? formatDate(j.scheduledAt) : formatDate(j.createdAt)}
                      </td>
                      <td className="px-2 py-3">
                        <Icon icon={ChevronRight} size={16} className="text-muted-foreground/40" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Estimates */}
        <TabsContent value="estimates" className="mt-4">
          {custEstimates.length === 0 ? (
            <div className="bg-card rounded-xl border border-dashed border-border p-12 text-center">
              <Icon icon={FileText} size={48} className="text-muted-foreground/25 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No estimates yet</p>
              <button
                type="button"
                onClick={() => setEstOpen(true)}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium"
              >
                + Create first estimate
              </button>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-low)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estimate</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Status</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {custEstimates.map((e: any) => (
                    <tr key={e.id}
                      className="border-b border-border/60 last:border-0 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{e.title}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <StatusBadge status={e.status} map={EST_STATUS} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">${Number(e.total ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{formatDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices" className="mt-4">
          {custInvoices.length === 0 ? (
            <div className="bg-card rounded-xl border border-dashed border-border p-12 text-center">
              <Icon icon={Receipt} size={48} className="text-muted-foreground/25 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No invoices yet</p>
              <button
                type="button"
                onClick={() => setInvOpen(true)}
                className="text-xs text-blue-500 hover:text-blue-700 font-medium"
              >
                + Create first invoice
              </button>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-low)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Invoice</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Status</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {custInvoices.map((inv: any) => (
                    <tr key={inv.id}
                      className="border-b border-border/60 last:border-0 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">#{inv.invoiceNumber}</p>
                        {inv.subject && <p className="text-xs text-muted-foreground truncate max-w-xs">{inv.subject}</p>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <StatusBadge status={inv.status} map={INV_STATUS} />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">${Number(inv.total ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {outstanding > 0 && (
                <div className="px-4 py-2.5 border-t border-border bg-blue-50/50 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Outstanding balance</span>
                  <span className="text-sm font-bold text-blue-700">${outstanding.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── New Job Dialog ── */}
      <Dialog open={jobOpen} onOpenChange={o => { if (!o) { setJobOpen(false); jobForm.reset(); } }}>
        <DialogContent className="max-w-lg bg-card" style={{ maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>New Job</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={jobForm.handleSubmit(d => createJobMutation.mutate(d))}
            noValidate
            className="flex-1 overflow-y-auto px-6 pb-2 space-y-4"
          >
            <JobFormFields
              form={jobForm}
              customers={[]}
              technicians={technicians}
              lockedCustomerName={customer?.name}
              lockedAddress={addr ? { label: addr.label, address: addr.address, city: addr.city, state: addr.state, zip: addr.zip } : undefined}
              showStatus={false}
            />
            <FormActions
              submitLabel="Create Job"
              loadingLabel="Creating…"
              loading={createJobMutation.isPending}
              onCancel={() => { setJobOpen(false); jobForm.reset(); }}
            />
          </form>
        </DialogContent>
      </Dialog>

      {/* ── New Estimate Dialog ── */}
      <Dialog open={estOpen} onOpenChange={setEstOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>New Estimate</DialogTitle>
          </DialogHeader>
          <form id="new-est-form" onSubmit={estForm.handleSubmit(d => createEstMutation.mutate(d))} className="space-y-4 px-6 pb-2">
            <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Icon icon={Building2} size={14} className="text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-foreground">{customer?.name}</span>
                <Icon icon={Lock} size={12} className="text-muted-foreground ml-auto" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon icon={MapPin} size={14} className="flex-shrink-0" />
                <span>{addr?.label}{fullAddress ? ` · ${fullAddress}` : ""}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Title <span className="text-destructive">*</span></Label>
              <Input {...estForm.register("title")} placeholder="e.g. HVAC Repair Estimate" className="h-9" />
              {estForm.formState.errors.title && <p className="text-xs text-destructive">{estForm.formState.errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notes</Label>
              <Textarea {...estForm.register("notes")} placeholder="Notes for this estimate…" className="min-h-[72px] resize-none" />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEstOpen(false)} className="h-9">Cancel</Button>
            <Button type="submit" form="new-est-form" className="h-9 bg-blue-500 hover:bg-blue-700 text-white" disabled={createEstMutation.isPending}>
              {createEstMutation.isPending ? "Creating…" : "Create Estimate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Invoice Dialog ── */}
      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <form id="new-inv-form" onSubmit={invForm.handleSubmit(d => createInvMutation.mutate(d))} className="space-y-4 px-6 pb-2">
            <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Icon icon={Building2} size={14} className="text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-foreground">{customer?.name}</span>
                <Icon icon={Lock} size={12} className="text-muted-foreground ml-auto" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon icon={MapPin} size={14} className="flex-shrink-0" />
                <span>{addr?.label}{fullAddress ? ` · ${fullAddress}` : ""}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Subject</Label>
              <Input {...invForm.register("subject")} placeholder="e.g. HVAC Service — March 2026" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Terms</Label>
              <select
                {...invForm.register("paymentTerms")}
                defaultValue="due_on_receipt"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="due_on_receipt">Due on Receipt</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_60">Net 60</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notes</Label>
              <Textarea {...invForm.register("notes")} placeholder="Notes for this invoice…" className="min-h-[60px] resize-none" />
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInvOpen(false)} className="h-9">Cancel</Button>
            <Button type="submit" form="new-inv-form" className="h-9 bg-blue-500 hover:bg-blue-700 text-white" disabled={createInvMutation.isPending}>
              {createInvMutation.isPending ? "Creating…" : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Address Dialog ── */}
      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent
          onPointerDownOutside={(e: Event) => { if ((e.target as HTMLElement)?.closest?.(".pac-container")) e.preventDefault(); }}
          onInteractOutside={(e: Event) => { if ((e.target as HTMLElement)?.closest?.(".pac-container")) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>Edit Address</DialogTitle>
          </DialogHeader>
          <form id="addr-edit-form" onSubmit={form.handleSubmit(d => updateMutation.mutate({ ...d, label: d.address || "Service Address" }))} className="space-y-4 px-6 pb-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Street Address <span className="text-destructive">*</span></Label>
              <AddressAutocompleteInput
                {...form.register("address")}
                onPlaceSelect={(r) => {
                  form.setValue("label",   r.address || "Service Address");
                  form.setValue("address", r.address);
                  form.setValue("city",    r.city);
                  form.setValue("state",   r.state);
                  form.setValue("zip",     r.zip);
                  setWatchedCity(r.city);
                  setWatchedState(r.state);
                  setWatchedZip(r.zip);
                }}
                placeholder="123 Main St"
                className="h-9"
              />
              {form.formState.errors.address && <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1.5">
                <Label className="text-xs font-semibold">City <span className="text-destructive">*</span></Label>
                <Input {...form.register("city")} value={watchedCity} onChange={e => { setWatchedCity(e.target.value); form.setValue("city", e.target.value); }} placeholder="Chicago" className="h-9" />
                {form.formState.errors.city && <p className="text-xs text-destructive">{form.formState.errors.city.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">State <span className="text-destructive">*</span></Label>
                <Input {...form.register("state")} value={watchedState} onChange={e => { setWatchedState(e.target.value); form.setValue("state", e.target.value); }} placeholder="IL" className="h-9" />
                {form.formState.errors.state && <p className="text-xs text-destructive">{form.formState.errors.state.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ZIP <span className="text-destructive">*</span></Label>
                <Input {...form.register("zip")} value={watchedZip} onChange={e => { setWatchedZip(e.target.value); form.setValue("zip", e.target.value); }} placeholder="60601" className="h-9" />
                {form.formState.errors.zip && <p className="text-xs text-destructive">{form.formState.errors.zip.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Access Notes</Label>
              <Input {...form.register("notes")} placeholder="Gate code, floor, unit…" className="h-9" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register("isPrimary")} className="w-4 h-4 accent-blue-500" />
              Set as primary address
            </label>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="h-9">Cancel</Button>
            <Button type="submit" form="addr-edit-form" className="h-9 bg-blue-500 hover:bg-blue-700 text-white" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
