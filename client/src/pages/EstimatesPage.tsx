import { useAutoCreate } from "@/hooks/useAutoCreate";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { estimatesApi, customersApi, invoicesApi, settingsApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import type { Estimate, Customer } from "@shared/schema";
import type { LineItem } from "@shared/schema";
import { cn, formatDate, formatCurrency, formatStatus } from "@/lib/utils";
import { buildDocumentHtml } from "@/lib/printDocument";
import { DocumentPreviewDialog } from "@/components/DocumentPreviewDialog";
import { LineItemsEditor } from "@/components/LineItemsEditor";
import {
  Plus, Pencil, Trash2, MoreVertical, FileText, X, Printer,
  Send, CheckCircle2, ThumbsDown, Receipt, Search, Archive,
  SlidersHorizontal, ExternalLink, TrendingUp, User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { AddressSelector } from "@/components/AddressSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TextInput, TextareaInput, DateInput, NumberInput, SelectInput, FormSection, FormField } from "@/components/forms";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── schema ─────────────────────────────────────────────────────────────── */
const schema = z.object({
  customerId: z.number({ coerce: true }),
  title:      z.string().min(1, "Title required"),
  status:     z.string().default("draft"),
  notes:      z.string().optional(),
  validUntil: z.string().optional().nullable(),
  taxRate:    z.number({ coerce: true }).default(0),
});
type FormData = z.infer<typeof schema>;

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:             { label: "Draft",             cls: "bg-muted/40 text-muted-foreground" },
  awaiting_response: { label: "Awaiting Response", cls: "bg-blue-100 text-blue-700" },
  changes_requested: { label: "Changes Requested", cls: "bg-amber-100 text-amber-700" },
  approved:          { label: "Approved",          cls: "bg-emerald-100 text-emerald-700" },
  converted:         { label: "Converted",         cls: "bg-purple-100 text-purple-700" },
  archived:          { label: "Archived",          cls: "bg-muted/40 text-muted-foreground" },
};
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: formatStatus(status), cls: "bg-muted/40 text-muted-foreground" };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap", m.cls)}>{m.label}</span>;
}
function MetricCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string;
  icon: LucideIcon;
  color: "green" | "blue" | "red" | "orange";
}) {
  const bg = { green: "bg-emerald-500", blue: "bg-blue-500", red: "bg-red-500", orange: "bg-orange-500" }[color];
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
export function EstimatesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editItem, setEditItem]       = useState<Estimate | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [lineItems, setLineItems]   = useState<LineItem[]>([{ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: estimates = [], isLoading } = useQuery<Estimate[]>({ queryKey: ["/api/estimates"], queryFn: estimatesApi.getAll, refetchInterval: 60_000 });
  const { data: customers = [] }            = useQuery<Customer[]>({ queryKey: ["/api/customers"], queryFn: customersApi.getAll });
  const { data: settings = {} }             = useQuery<Record<string, string>>({ queryKey: ["/api/settings"], queryFn: settingsApi.getAll });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "draft", taxRate: 0 },
    values: editItem ? {
      customerId: editItem.customerId ?? (undefined as any),
      title:      editItem.title,
      status:     editItem.status,
      notes:      editItem.notes ?? "",
      validUntil: editItem.validUntil ? new Date(editItem.validUntil).toISOString().slice(0, 10) : "",
      taxRate: (() => {
        const sub = parseFloat(String(editItem.subtotal ?? "0"));
        const tax = parseFloat(String(editItem.tax ?? "0"));
        return sub > 0 ? parseFloat(((tax / sub) * 100).toFixed(4)) : 0;
      })(),
    } : undefined,
  });

  const toastErr = (title: string, err: unknown) =>
    toast({ title, description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });

  const createMutation   = useMutation({ mutationFn: (d: any) => estimatesApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/estimates"] }); closeDialog(); }, onError: (err: unknown) => toastErr("Could not create estimate", err) });
  const updateMutation   = useMutation({ mutationFn: ({ id, data }: any) => estimatesApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/estimates"] }); closeDialog(); }, onError: (err: unknown) => toastErr("Could not save estimate", err) });
  const deleteMutation   = useMutation({ mutationFn: (id: number) => estimatesApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/estimates"] }), onError: (err: unknown) => toastErr("Could not delete estimate", err) });
  const statusMutation   = useMutation({ mutationFn: ({ id, data }: any) => estimatesApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/estimates"] }), onError: (err: unknown) => toastErr("Status update failed", err) });
  const convertMutation  = useMutation({
    mutationFn: async (est: Estimate) => estimatesApi.convertToInvoice(est.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/invoices"] });
      qc.invalidateQueries({ queryKey: ["/api/estimates"] });
    },
    onError: (err: unknown) => toastErr("Could not convert estimate", err),
  });

  function openCreate() { setEditItem(null); setLineItems([{ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, total: 0 }]); reset({ status: "draft", taxRate: 0 }); setSelectedAddressId(null); setDialogOpen(true); }
  useAutoCreate(openCreate);
  function openEdit(e: Estimate) {
    setEditItem(e);
    setLineItems((e.lineItems as LineItem[]) ?? []);
    const sub = parseFloat(String(e.subtotal ?? "0"));
    const tax = parseFloat(String(e.tax ?? "0"));
    const taxRate = sub > 0 ? parseFloat(((tax / sub) * 100).toFixed(4)) : 0;
    reset({ customerId: e.customerId ?? undefined, title: e.title, status: e.status, notes: e.notes ?? "", validUntil: e.validUntil ? new Date(e.validUntil).toISOString().slice(0, 10) : "", taxRate });
    setDialogOpen(true);
  }
  function closeDialog() { setDialogOpen(false); setEditItem(null); reset(); setSelectedAddressId(null); }

  const taxRate  = watch("taxRate") || 0;
  const subtotal = lineItems.reduce((s, li) => s + (Number(li.total) || 0), 0);
  const tax      = subtotal * (taxRate / 100);
  const total    = subtotal + tax;

  const onSubmit = (data: FormData) => {
    const payload = { customerId: data.customerId, title: data.title, status: data.status, notes: data.notes, validUntil: data.validUntil ? new Date(data.validUntil) : null, lineItems, subtotal: subtotal.toFixed(2), tax: tax.toFixed(2), total: total.toFixed(2) };
    if (editItem) updateMutation.mutate({ id: editItem.id, data: payload });
    else createMutation.mutate(payload);
  };

  const handlePrint = async (est: Estimate) => {
    const customer = customers.find(c => c.id === est.customerId);
    if (!customer) return;
    let serviceAddress = null;
    try {
      const addrs = await customersApi.getAddresses(est.customerId);
      const primary = addrs.find((a: any) => a.isPrimary) ?? addrs[0] ?? null;
      if (primary) serviceAddress = { address: primary.address, city: primary.city, state: primary.state, zip: primary.zip };
    } catch (e) { console.error("Failed to load service address:", e); }
    setPreviewHtml(buildDocumentHtml({ type: "estimate", number: String(est.id), title: est.title, status: est.status, customer, serviceAddress, lineItems: (est.lineItems as LineItem[]) ?? [], subtotal: est.subtotal ?? 0, tax: est.tax ?? 0, total: est.total ?? 0, notes: est.notes, createdAt: est.createdAt, validUntil: est.validUntil, company: settings }));
  };

  /* metrics */
  const approvedTotal  = estimates.filter(e => e.status === "approved").reduce((s, e) => s + parseFloat(e.total ?? "0"), 0);
  const pendingTotal   = estimates.filter(e => ["draft","awaiting_response"].includes(e.status)).reduce((s, e) => s + parseFloat(e.total ?? "0"), 0);
  const rejectedCount  = estimates.filter(e => ["rejected","changes_requested"].includes(e.status)).length;
  const convertedCount = estimates.filter(e => e.status === "converted").length;
  const convRate       = estimates.length > 0 ? Math.round((convertedCount / estimates.length) * 100) : 0;

  const filtered = estimates.filter(e => {
    const c = customers.find(x => x.id === e.customerId);
    return (!search || e.title.toLowerCase().includes(search.toLowerCase()) || (c?.name ?? "").toLowerCase().includes(search.toLowerCase()))
      && (filterStatus === "all" || e.status === filterStatus);
  });

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Approved Value"   value={formatCurrency(approvedTotal)} icon={CheckCircle2} color="green"  />
        <MetricCard label="Pending Value"    value={formatCurrency(pendingTotal)}  icon={FileText}     color="blue"   />
        <MetricCard label="Declined"         value={String(rejectedCount)}         icon={ThumbsDown}   color="red"    />
        <MetricCard label="Conversion Rate"  value={`${convRate}%`}               icon={TrendingUp}   color="orange" sub={`${convertedCount} converted`} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Icon icon={Search} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search estimates…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-card" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><Icon icon={X} size={14} /></button>}
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-44 text-sm bg-card">
            <Icon icon={SlidersHorizontal} size={14} className="mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="awaiting_response">Awaiting Response</SelectItem>
            <SelectItem value="changes_requested">Changes Requested</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="ml-auto h-8 bg-orange-500 hover:bg-orange-600 text-white text-sm px-3">
          <Icon icon={Plus} size={14} className="mr-1.5" /> New Estimate
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-low)" }}>
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><Icon icon={FileText} size={28} /></div>
            <p className="empty-state__title">{search || filterStatus !== "all" ? "No estimates match your filters" : "No estimates yet"}</p>
            <p className="empty-state__desc">{search || filterStatus !== "all" ? "Try a different search or clear the filters." : "Create your first estimate."}</p>
            {!search && filterStatus === "all" && <Button onClick={openCreate} className="mt-4 h-8 bg-orange-500 hover:bg-orange-600 text-white text-sm"><Icon icon={Plus} size={14} className="mr-1.5" />New Estimate</Button>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estimate</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Client</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Valid Until</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Created</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(est => {
                    const customer = customers.find(c => c.id === est.customerId);
                    return (
                      <tr key={est.id} className={cn("border-b border-border/60 last:border-0 hover:bg-muted/30 group transition-colors", est.status !== "converted" && "cursor-pointer")} onClick={() => est.status !== "converted" && est.status !== "archived" && openEdit(est)}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground truncate max-w-[200px]">{est.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">#{est.id}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {customer ? <div className="flex items-center gap-1.5"><Icon icon={User} size={12} className="text-muted-foreground/60" /><span className="text-sm text-foreground">{customer.name}</span></div> : <span className="text-sm text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={est.status} /></td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">{formatCurrency(est.total ?? "0")}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{est.validUntil ? formatDate(est.validUntil) : "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{formatDate(est.createdAt)}</td>
                        <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"><Icon icon={MoreVertical} size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {est.status !== "converted" && est.status !== "archived" && <DropdownMenuItem onClick={() => openEdit(est)}><Icon icon={Pencil} size={16} className="mr-2" />Edit</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => handlePrint(est)}><Icon icon={Printer} size={16} className="mr-2" />Print / PDF</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {est.status === "draft" && <DropdownMenuItem disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: est.id, data: { status: "awaiting_response" } })}><Icon icon={Send} size={16} className="mr-2" />Send to Client</DropdownMenuItem>}
                              {["awaiting_response","sent"].includes(est.status) && <DropdownMenuItem disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: est.id, data: { status: "approved" } })}><Icon icon={CheckCircle2} size={16} className="mr-2" />Mark Approved</DropdownMenuItem>}
                              {["awaiting_response","sent"].includes(est.status) && <DropdownMenuItem disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: est.id, data: { status: "changes_requested" } })}><Icon icon={ThumbsDown} size={16} className="mr-2" />Changes Requested</DropdownMenuItem>}
                              {est.status === "approved" && <DropdownMenuItem disabled={convertMutation.isPending} onClick={() => convertMutation.mutate(est)}><Icon icon={Receipt} size={16} className="mr-2" />Convert to Invoice</DropdownMenuItem>}
                              {est.status !== "archived" && <DropdownMenuItem disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: est.id, data: { status: "archived" } })}><Icon icon={Archive} size={16} className="mr-2" />Archive</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { if (confirm("Delete estimate?")) deleteMutation.mutate(est.id); }}><Icon icon={Trash2} size={16} className="mr-2" />Delete</DropdownMenuItem>
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
              <p className="text-xs text-muted-foreground">Showing {filtered.length} of {estimates.length} estimates</p>
            </div>
          </>
        )}
      </div>

      <DocumentPreviewDialog html={previewHtml} title="Estimate Preview" onClose={() => setPreviewHtml(null)} />

      {/* ── Create / Edit Dialog — two-panel Jobber layout ── */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && closeDialog()}>
        <DialogContent className="max-w-4xl p-0 gap-0 bg-background overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }}>
          <DialogDescription className="sr-only">Create or edit an estimate</DialogDescription>
          {/* Dialog header */}
          <DialogHeader className="px-6 py-4 bg-card border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold">
                {editItem ? `Edit Estimate #${editItem.id}` : "New Estimate"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={closeDialog}>Cancel</Button>
                <Button
                  size="sm"
                  className="h-8 bg-orange-500 hover:bg-orange-600 text-white min-w-[120px]"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  onClick={handleSubmit(onSubmit)}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving…" : editItem ? "Save Changes" : "Create Estimate"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-4 max-w-xl mx-auto">
              <FormSection title="Client & Title">
                <TextInput label="Title" required placeholder="e.g. Electrical Panel Upgrade" error={errors.title} {...register("title")} />
                <FormField label="Client" required error={errors.customerId ? "Client is required" : undefined}>
                  <CustomerCombobox customers={customers} value={watch("customerId") ?? null} onChange={id => { setValue("customerId", id ?? (undefined as any)); setSelectedAddressId(null); }} />
                </FormField>
                <AddressSelector customerId={watch("customerId")} value={selectedAddressId} onChange={(id) => setSelectedAddressId(id)} />
              </FormSection>

              <FormSection title="Status & Dates">
                <SelectInput
                  label="Status"
                  value={watch("status")}
                  onValueChange={v => setValue("status", v)}
                  options={[
                    { value: "draft",              label: "Draft" },
                    { value: "awaiting_response",  label: "Awaiting Response" },
                    { value: "changes_requested",  label: "Changes Requested" },
                    { value: "approved",           label: "Approved" },
                    { value: "archived",           label: "Archived" },
                  ]}
                />
                <DateInput label="Valid Until" {...register("validUntil")} />
                <NumberInput label="Tax Rate (%)" step={0.1} min={0} max={100} placeholder="0" {...register("taxRate")} />
              </FormSection>

              <FormSection title="Line Items">
                <LineItemsEditor items={lineItems} onChange={setLineItems} taxRate={taxRate} />
              </FormSection>

              <FormSection title="Notes">
                <TextareaInput label="" rows={3} placeholder="Notes visible to the client on the estimate…" {...register("notes")} />
              </FormSection>

              {editItem && (
                <FormSection title="Actions">
                  <button
                    type="button"
                    onClick={() => handlePrint(editItem)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors border border-border"
                  >
                    <Icon icon={Printer} size={14} className="text-muted-foreground" /> Print / Download PDF
                  </button>
                  {editItem.status === "draft" && (
                    <button type="button" onClick={() => { statusMutation.mutate({ id: editItem.id, data: { status: "awaiting_response" } }); closeDialog(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors border border-border">
                      <Icon icon={Send} size={14} className="text-muted-foreground" /> Send to Client
                    </button>
                  )}
                  {editItem.status === "approved" && (
                    <button type="button" onClick={() => { convertMutation.mutate(editItem); closeDialog(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-emerald-700 hover:bg-emerald-50 transition-colors border border-emerald-200">
                      <Icon icon={Receipt} size={14} /> Convert to Invoice
                    </button>
                  )}
                </FormSection>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
