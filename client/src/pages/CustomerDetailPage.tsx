import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { customersApi, jobsApi, estimatesApi, invoicesApi, requestsApi } from "@/lib/api"; // jobsApi etc kept for stats bar
import { cn, formatDate } from "@/lib/utils";
import { loadMapsLib } from "@/lib/google-maps";
import { AddressAutocompleteTextInput } from "@/components/AddressAutocompleteInput";
import type { PlaceResult } from "@/components/AddressAutocompleteInput";
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, Star,
  Pencil, Trash2, Plus, Briefcase, FileText, Receipt,
  CalendarDays, ChevronRight, MoreVertical, ClipboardList,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TextInput, TextareaInput, CheckboxInput, FormRow, FormActions } from "@/components/forms";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ─── Mini map preview ───────────────────────────────────────────────────── */
function MiniMapPreview({ lat, lng }: { lat: number; lng: number }) {
  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!divRef.current) return;
    loadMapsLib().then(() => {
      if (!divRef.current) return;
      const g = (window as any).google.maps;
      const map = new g.Map(divRef.current, { center: { lat, lng }, zoom: 15, disableDefaultUI: true, gestureHandling: "none", clickableIcons: false });
      new g.Marker({ position: { lat, lng }, map });
    }).catch(console.error);
  }, [lat, lng]);
  return <div ref={divRef} className="w-full h-36 rounded-md overflow-hidden border border-border" />;
}


type CustomerAddress = {
  id: number; customerId: number; label: string;
  address: string | null; city: string | null; state: string | null;
  zip: string | null; isPrimary: boolean; notes: string | null; createdAt: string;
};

/* ─── schemas ─────────────────────────────────────────────────────────────── */
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
  label:     z.string().optional(),
  address:   z.string().min(1, "Street address is required"),
  city:      z.string().min(1, "City is required"),
  state:     z.string().min(1, "State is required"),
  zip:       z.string().min(1, "ZIP is required"),
  notes:     z.string().optional(),
  isPrimary: z.boolean().optional(),
});
type AddressForm = z.infer<typeof addressSchema>;

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
function avatarColor(name: string) {
  const palette = [
    "bg-orange-100 text-orange-600", "bg-blue-100 text-blue-600",
    "bg-emerald-100 text-emerald-600", "bg-purple-100 text-purple-600",
    "bg-rose-100 text-rose-600", "bg-amber-100 text-amber-600",
    "bg-cyan-100 text-cyan-600",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

const JOB_STATUS: Record<string, { label: string; cls: string }> = {
  pending:     { label: "Pending",     cls: "bg-slate-100 text-slate-600" },
  assigned:    { label: "Assigned",    cls: "bg-blue-100 text-blue-700" },
  in_progress: { label: "In Progress", cls: "bg-orange-100 text-orange-700" },
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
const REQ_STATUS: Record<string, { label: string; cls: string }> = {
  new:                  { label: "New",                  cls: "bg-blue-100 text-blue-700" },
  triaged:              { label: "Triaged",              cls: "bg-yellow-100 text-yellow-700" },
  assessment_scheduled: { label: "Assessment Scheduled", cls: "bg-purple-100 text-purple-700" },
  converted:            { label: "Converted",            cls: "bg-emerald-100 text-emerald-700" },
  closed:               { label: "Closed",               cls: "bg-slate-100 text-slate-600" },
  archived:             { label: "Archived",             cls: "bg-muted/40 text-muted-foreground" },
};
const REQ_PRIORITY: Record<string, { label: string; cls: string }> = {
  emergency: { label: "Emergency", cls: "bg-red-100 text-red-700" },
  high:      { label: "High",      cls: "bg-orange-100 text-orange-700" },
  normal:    { label: "Normal",    cls: "bg-muted/40 text-muted-foreground" },
  low:       { label: "Low",       cls: "bg-sky-50 text-sky-600" },
};

function Badge({ status, map }: { status: string; map: Record<string, { label: string; cls: string }> }) {
  const m = map[status] ?? { label: status, cls: "bg-muted/40 text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap", m.cls)}>
      {m.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const customerId = id && /^\d+$/.test(id) ? Number(id) : null;
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [editOpen, setEditOpen]       = useState(false);
  const [addrOpen, setAddrOpen]       = useState(false);
  const [addrMapPin, setAddrMapPin]   = useState<{ lat: number; lng: number } | null>(null);
  const [editAddress, setEditAddress] = useState<CustomerAddress | null>(null);

  /* ── queries ── */
  const { data: customer, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/customers", customerId],
    queryFn: () => customersApi.getById(customerId!),
    enabled: customerId != null,
    retry: false,
  });
  const { data: addresses = [] } = useQuery<CustomerAddress[]>({
    queryKey: ["/api/customers", customerId, "addresses"],
    queryFn: () => customersApi.getAddresses(customerId!),
    enabled: customerId != null,
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
  const { data: custRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "requests"],
    queryFn: () => customersApi.getRequests(customerId!),
    enabled: customerId != null,
  });

  const custJobs      = allJobs.filter(j => j.customerId === customerId);
  const custEstimates = allEstimates.filter(e => e.customerId === customerId);
  const custInvoices  = allInvoices.filter(i => i.customerId === customerId);
  const outstanding   = custInvoices
    .filter(i => ["sent", "overdue"].includes(i.status))
    .reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);

  /* ── forms ── */
  const editForm = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    values: customer ? {
      name:       customer.name,
      company:    customer.company ?? "",
      email:      customer.email ?? "",
      phone:      customer.phone ?? "",
      notes:      customer.notes ?? "",
      tags:       (customer.tags ?? []).join(", "),
      leadSource: customer.leadSource ?? "",
    } : undefined,
  });
  const addrForm = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: { label: "Service Address" },
    values: editAddress ? {
      label:     editAddress.label,
      address:   editAddress.address ?? "",
      city:      editAddress.city ?? "",
      state:     editAddress.state ?? "",
      zip:       editAddress.zip ?? "",
      notes:     editAddress.notes ?? "",
      isPrimary: editAddress.isPrimary,
    } : undefined,
  });

  const { toast } = useToast();
  const toastErr = (title: string, err: unknown) =>
    toast({ title, description: err instanceof Error ? err.message : "An error occurred", variant: "destructive" });

  /* ── mutations ── */
  const updateMutation = useMutation({
    mutationFn: (data: any) => customersApi.update(customerId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/customers", customerId] });
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      setEditOpen(false);
    },
    onError: (err: unknown) => toastErr("Could not save client", err),
  });
  const deleteMutation = useMutation({
    mutationFn: () => customersApi.delete(customerId!),
    onSuccess: () => navigate("/customers"),
    onError: (err: unknown) => toastErr("Could not delete client", err),
  });
  const createAddrMutation = useMutation({
    mutationFn: (data: AddressForm) => customersApi.createAddress(customerId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/customers", customerId, "addresses"] });
      closeAddrDialog();
    },
    onError: (err: unknown) => toastErr("Could not add address", err),
  });
  const updateAddrMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: AddressForm }) =>
      customersApi.updateAddress(customerId!, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/customers", customerId, "addresses"] });
      closeAddrDialog();
    },
    onError: (err: unknown) => toastErr("Could not update address", err),
  });
  const deleteAddrMutation = useMutation({
    mutationFn: (id: number) => customersApi.deleteAddress(customerId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/customers", customerId, "addresses"] }),
    onError: (err: unknown) => toastErr("Could not delete address", err),
  });

  /* ── handlers ── */
  function openEdit() {
    if (!customer) return;
    editForm.reset({
      name: customer.name, company: customer.company ?? "",
      email: customer.email ?? "", phone: customer.phone ?? "",
      notes: customer.notes ?? "",
      tags: (customer.tags ?? []).join(", "),
      leadSource: customer.leadSource ?? "",
    });
    setEditOpen(true);
  }
  const onEditSubmit = (data: CustomerForm) => {
    const tags = data.tags ? data.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [];
    updateMutation.mutate({ ...data, tags });
  };

  const [addrCity,  setAddrCity]  = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrZip,   setAddrZip]   = useState("");

  function openAddrCreate() {
    setEditAddress(null);
    setAddrMapPin(null);
    setAddrCity(""); setAddrState(""); setAddrZip("");
    addrForm.reset({ label: "Service Address", address: "", city: "", state: "", zip: "", notes: "", isPrimary: addresses.length === 0 });
    setAddrOpen(true);
  }
  function openAddrEdit(a: CustomerAddress, e: React.MouseEvent) {
    e.stopPropagation();
    setEditAddress(a);
    setAddrCity(a.city ?? ""); setAddrState(a.state ?? ""); setAddrZip(a.zip ?? "");
    addrForm.reset({ label: a.label, address: a.address ?? "", city: a.city ?? "", state: a.state ?? "", zip: a.zip ?? "", notes: a.notes ?? "", isPrimary: a.isPrimary });
    setAddrOpen(true);
  }
  function closeAddrDialog() { setAddrOpen(false); setEditAddress(null); setAddrCity(""); setAddrState(""); setAddrZip(""); addrForm.reset(); }
  const onAddrSubmit = (data: AddressForm) => {
    // Use address as label if label wasn't explicitly set
    const label = data.label || data.address || "Service Address";
    if (editAddress) updateAddrMutation.mutate({ id: editAddress.id, data: { ...data, label } });
    else createAddrMutation.mutate({ ...data, label });
  };

  /* ── loading / not found ── */
  if (customerId == null) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Customer not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/customers")}>
          Back to Customers
        </Button>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }
  if (isError || !customer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Customer not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/customers")}>
          Back to Customers
        </Button>
      </div>
    );
  }

  const tags: string[] = customer.tags ?? [];

  return (
    <div className="space-y-6">

      {/* ── Back ── */}
      <button
        onClick={() => navigate("/customers")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Icon icon={ArrowLeft} size={16} /> All Clients
      </button>

      {/* ── Customer Header Card ── */}
      <div className="bg-card rounded-xl border border-border" style={{ boxShadow: "var(--shadow-low)" }}>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0", avatarColor(customer.name))}>
                {getInitials(customer.name)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground leading-tight">{customer.name}</h1>
                {customer.company && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Icon icon={Building2} size={14} /> {customer.company}
                  </p>
                )}
                {customer.leadSource && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Icon icon={Star} size={12} /> {customer.leadSource}
                  </p>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tags.map((t: string) => (
                      <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {customer.phone && (
                <a href={`tel:${customer.phone}`}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium transition-colors">
                  <Icon icon={Phone} size={14} /> Call
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium transition-colors">
                  <Icon icon={Mail} size={14} /> Email
                </a>
              )}
              <Button onClick={openEdit} variant="outline" className="h-9">
                <Icon icon={Pencil} size={14} className="mr-1.5" /> Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9"><Icon icon={MoreVertical} size={16} /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => { if (confirm(`Delete ${customer.name}?`)) deleteMutation.mutate(); }}
                  >
                    <Icon icon={Trash2} size={16} className="mr-2" /> Delete Client
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {(customer.phone || customer.email) && (
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon icon={Phone} size={14} /> {customer.phone}
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon icon={Mail} size={14} /> {customer.email}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="border-t border-border bg-muted/30 px-6 py-3 flex flex-wrap gap-6 rounded-b-xl">
          <div className="flex items-center gap-2">
            <Icon icon={ClipboardList} size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold">{custRequests.length}</span>
            <span className="text-xs text-muted-foreground">Requests</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon={Briefcase} size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold">{custJobs.length}</span>
            <span className="text-xs text-muted-foreground">Jobs</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon={FileText} size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold">{custEstimates.length}</span>
            <span className="text-xs text-muted-foreground">Estimates</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon icon={Receipt} size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold">{custInvoices.length}</span>
            <span className="text-xs text-muted-foreground">Invoices</span>
          </div>
          {outstanding > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm font-bold text-orange-600">${outstanding.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">Outstanding</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon icon={CalendarDays} size={14} />
            Client since {formatDate(customer.createdAt)}
          </div>
        </div>
      </div>

      {/* ── Notes ── */}
      {customer.notes && (
        <div className="bg-card rounded-lg border border-border p-4 text-sm text-foreground whitespace-pre-line leading-relaxed">
          {customer.notes}
        </div>
      )}

      {/* ── Addresses ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Addresses</h2>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
              {addresses.length}
            </span>
          </div>
          <button
            onClick={openAddrCreate}
            className="flex items-center gap-1 text-xs font-medium text-orange-500 hover:text-orange-600 transition-colors"
          >
            <Icon icon={Plus} size={14} /> Add Address
          </button>
        </div>

        {addresses.length === 0 ? (
          <div className="bg-card rounded-lg border border-border border-dashed p-10 text-center">
            <Icon icon={MapPin} size={40} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-2">No addresses yet</p>
            <button onClick={openAddrCreate} className="text-xs text-orange-500 hover:text-orange-600 font-medium">
              + Add first address
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {addresses.map(a => (
              <div
                key={a.id}
                onClick={() => navigate(`/customers/${customerId}/addresses/${a.id}`)}
                className={cn(
                  "bg-card rounded-xl border cursor-pointer group transition-all hover:shadow-md hover:-translate-y-0.5 relative",
                  a.isPrimary ? "border-orange-200 ring-1 ring-orange-200" : "border-border hover:border-orange-200"
                )}
                style={{ boxShadow: "var(--shadow-low)" }}
              >
                {/* Edit/Delete — shown on hover */}
                <div
                  className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={e => openAddrEdit(a, e)}
                    className="p-1.5 rounded-md bg-background/80 border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon icon={Pencil} size={12} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm("Delete this address?")) deleteAddrMutation.mutate(a.id); }}
                    className="p-1.5 rounded-md bg-background/80 border border-border hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Icon icon={Trash2} size={12} />
                  </button>
                </div>

                <div className="p-5">
                  {/* Icon + label */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                      a.isPrimary ? "bg-orange-500" : "bg-muted"
                    )}>
                      <Icon icon={MapPin} size={16} className={cn(a.isPrimary ? "text-white" : "text-muted-foreground")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground text-sm leading-tight truncate pr-8">{a.label}</p>
                      {a.isPrimary && (
                        <span className="inline-flex mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                          Primary
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Address lines */}
                  <div className="space-y-0.5 min-h-[40px]">
                    {(a.address || a.city) ? (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent([a.address, a.city, a.state, a.zip].filter(Boolean).join(", "))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:text-orange-500 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        {a.address && <p className="text-sm text-foreground">{a.address}</p>}
                        {(a.city || a.state || a.zip) && (
                          <p className="text-sm text-muted-foreground">
                            {[a.city, a.state, a.zip].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground/50 italic">No address details</p>
                    )}
                  </div>

                  {a.notes && (
                    <p className="mt-2 text-xs text-muted-foreground/70 italic border-t border-border pt-2">{a.notes}</p>
                  )}

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-end">
                    <Icon icon={ChevronRight} size={16} className="text-muted-foreground/40 group-hover:text-orange-500 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Requests ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Requests</h2>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
            {custRequests.length}
          </span>
        </div>

        {custRequests.length === 0 ? (
          <div className="bg-card rounded-lg border border-border border-dashed p-10 text-center">
            <Icon icon={ClipboardList} size={40} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No requests yet</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-low)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Request</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Status</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Priority</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Source</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Date</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {custRequests.map((req: any) => (
                  <tr
                    key={req.id}
                    onClick={() => navigate(`/requests?id=${req.id}`)}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{req.title}</p>
                      <p className="text-xs text-muted-foreground">#{req.id}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge status={req.status} map={REQ_STATUS} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge status={req.priority} map={REQ_PRIORITY} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell capitalize">
                      {req.source ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                      {formatDate(req.createdAt)}
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
      </section>


      {/* ── Edit Customer Dialog ── */}
      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent className="max-w-xl bg-card">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} noValidate className="space-y-3 px-6 pb-4 max-h-[60vh] overflow-y-auto">
            <FormRow cols={2}>
              <TextInput label="Full Name" required error={editForm.formState.errors.name}  {...editForm.register("name")} />
              <TextInput label="Company"                                                     {...editForm.register("company")} />
              <TextInput label="Phone"                                                        {...editForm.register("phone")} />
              <TextInput label="Email"    type="email" error={editForm.formState.errors.email} {...editForm.register("email")} />
              <TextInput label="Lead Source" placeholder="Referral, Google…"                 {...editForm.register("leadSource")} />
              <TextInput label="Tags"        placeholder="residential, vip"                  {...editForm.register("tags")} />
            </FormRow>
            <TextareaInput label="Notes" rows={3} {...editForm.register("notes")} />
            <FormActions submitLabel="Save Changes" loading={updateMutation.isPending} onCancel={() => setEditOpen(false)} />
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Address Dialog ── */}
      <Dialog open={addrOpen} onOpenChange={o => { if (!o) { closeAddrDialog(); setAddrMapPin(null); } }}>
        <DialogContent
          className="max-w-md bg-card"
          onPointerDownOutside={e => { if ((e.target as HTMLElement)?.closest?.(".pac-container")) e.preventDefault(); }}
          onInteractOutside={e => { if ((e.target as HTMLElement)?.closest?.(".pac-container")) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>{editAddress ? "Edit Address" : "Add Address"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={addrForm.handleSubmit(onAddrSubmit)} noValidate className="space-y-3 px-6 pb-4">
            {/* Mini map preview */}
            {addrMapPin && (
              <MiniMapPreview lat={addrMapPin.lat} lng={addrMapPin.lng} />
            )}
            <div className="space-y-3">
              <AddressAutocompleteTextInput
                label="Street Address"
                required
                error={addrForm.formState.errors.address}
                placeholder="123 Main St"
                {...addrForm.register("address")}
                onPlaceSelect={(r: PlaceResult) => {
                  addrForm.setValue("label",   r.address || "Service Address");
                  addrForm.setValue("address", r.address);
                  addrForm.setValue("city",    r.city);
                  addrForm.setValue("state",   r.state);
                  addrForm.setValue("zip",     r.zip);
                  setAddrCity(r.city);
                  setAddrState(r.state);
                  setAddrZip(r.zip);
                  if (r.lat !== null && r.lng !== null) setAddrMapPin({ lat: r.lat, lng: r.lng });
                }}
              />
              <FormRow cols={3}>
                <TextInput label="City"  required placeholder="Chicago" error={addrForm.formState.errors.city}  {...addrForm.register("city")}  value={addrCity}  onChange={e => { setAddrCity(e.target.value);  addrForm.setValue("city",  e.target.value); }} />
                <TextInput label="State" required placeholder="IL"      error={addrForm.formState.errors.state} {...addrForm.register("state")} value={addrState} onChange={e => { setAddrState(e.target.value); addrForm.setValue("state", e.target.value); }} />
                <TextInput label="ZIP"   required placeholder="60601"   error={addrForm.formState.errors.zip}   {...addrForm.register("zip")}   value={addrZip}   onChange={e => { setAddrZip(e.target.value);   addrForm.setValue("zip",   e.target.value); }} />
              </FormRow>
              <TextInput label="Access Notes" placeholder="Gate code, floor, unit…" {...addrForm.register("notes")} />
              <CheckboxInput
                label="Set as primary address"
                checked={addrForm.watch("isPrimary") ?? false}
                onCheckedChange={v => addrForm.setValue("isPrimary", v)}
              />
            </div>
            <FormActions
              submitLabel={editAddress ? "Save Changes" : "Add Address"}
              loading={createAddrMutation.isPending || updateAddrMutation.isPending}
              onCancel={closeAddrDialog}
            />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
