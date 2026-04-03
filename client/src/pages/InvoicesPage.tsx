import { useAutoCreate } from "@/hooks/useAutoCreate";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { invoicesApi, customersApi, settingsApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, Customer } from "@shared/schema";
import type { LineItem } from "@shared/schema";
import { cn, formatDate, formatCurrency, formatStatus } from "@/lib/utils";
import { buildDocumentHtml } from "@/lib/printDocument";
import { DocumentPreviewDialog } from "@/components/DocumentPreviewDialog";
import { LineItemsEditor } from "@/components/LineItemsEditor";
import {
  Plus, Pencil, Trash2, MoreVertical, Receipt, CheckCircle2,
  X, DollarSign, Printer, Send, Search, SlidersHorizontal, User,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { AddressSelector } from "@/components/AddressSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { TextInput, TextareaInput, DateInput, NumberInput, SelectInput, FormSection, FormField } from "@/components/forms";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── schema ─────────────────────────────────────────────────────────────── */
const schema = z.object({
  customerId:   z.number({ coerce: true }),
  subject:      z.string().optional(),
  status:       z.string().default("draft"),
  paymentTerms: z.string().default("due_on_receipt"),
  notes:        z.string().optional(),
  dueDate:      z.string().optional().nullable(),
  taxRate:      z.number({ coerce: true }).default(0),
});
type FormData = z.infer<typeof schema>;

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:   { label: "Draft",   cls: "bg-muted/40 text-muted-foreground" },
  sent:    { label: "Sent",    cls: "bg-blue-100 text-blue-700" },
  paid:    { label: "Paid",    cls: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "Overdue", cls: "bg-red-100 text-red-700" },
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
export function InvoicesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const autoSuggestedDueDate = useRef(false);
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editItem, setEditItem]       = useState<Invoice | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [lineItems, setLineItems]   = useState<LineItem[]>([{ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"], queryFn: invoicesApi.getAll, refetchInterval: 60_000 });
  const { data: customers = [] }           = useQuery<Customer[]>({ queryKey: ["/api/customers"], queryFn: customersApi.getAll });
  const { data: settings = {} }            = useQuery<Record<string, string>>({ queryKey: ["/api/settings"], queryFn: settingsApi.getAll });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "draft", paymentTerms: "due_on_receipt", taxRate: 0 },
    values: editItem ? {
      customerId:   editItem.customerId ?? (undefined as any),
      subject:      editItem.subject ?? "",
      status:       editItem.status,
      paymentTerms: editItem.paymentTerms ?? "due_on_receipt",
      notes:        editItem.notes ?? "",
      dueDate:      editItem.dueDate ? new Date(editItem.dueDate).toISOString().slice(0, 10) : "",
      taxRate: (() => {
        const sub = parseFloat(String(editItem.subtotal ?? "0"));
        const tax = parseFloat(String(editItem.tax ?? "0"));
        return sub > 0 ? parseFloat(((tax / sub) * 100).toFixed(4)) : 0;
      })(),
    } : undefined,
  });

  const toastErr = (title: string, err: unknown) =>
    toast({ title, description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });

  const createMutation = useMutation({ mutationFn: (d: any) => invoicesApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/invoices"] }); closeDialog(); }, onError: (err: unknown) => toastErr("Could not create invoice", err) });
  const updateMutation = useMutation({ mutationFn: ({ id, data }: any) => invoicesApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/invoices"] }); closeDialog(); }, onError: (err: unknown) => toastErr("Could not save invoice", err) });
  const deleteMutation = useMutation({ mutationFn: (id: number) => invoicesApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/invoices"] }), onError: (err: unknown) => toastErr("Could not delete invoice", err) });
  const statusMutation = useMutation({
    mutationFn: ({ id, data }: any) => invoicesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/invoices"] }),
    onError: (err: unknown) => toastErr("Status update failed", err),
  });
  const markPaidMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.markPaid(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/invoices"] }),
    onError: (err: unknown) => toastErr("Could not mark as paid", err),
  });

  function openCreate() { setEditItem(null); setLineItems([{ id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, total: 0 }]); reset({ status: "draft", paymentTerms: "due_on_receipt", taxRate: 0 }); setSelectedAddressId(null); autoSuggestedDueDate.current = false; setDialogOpen(true); }
  useAutoCreate(openCreate);
  function openEdit(inv: Invoice) {
    setEditItem(inv);
    setLineItems((inv.lineItems as LineItem[]) ?? []);
    const sub = parseFloat(String(inv.subtotal ?? "0"));
    const tax = parseFloat(String(inv.tax ?? "0"));
    const taxRate = sub > 0 ? parseFloat(((tax / sub) * 100).toFixed(4)) : 0;
    reset({ customerId: inv.customerId ?? undefined, subject: inv.subject ?? "", status: inv.status, paymentTerms: inv.paymentTerms ?? "due_on_receipt", notes: inv.notes ?? "", dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "", taxRate });
    autoSuggestedDueDate.current = false;
    setDialogOpen(true);
  }
  function closeDialog() { setDialogOpen(false); setEditItem(null); reset(); setSelectedAddressId(null); autoSuggestedDueDate.current = false; }

  const taxRate  = watch("taxRate") || 0;
  const subtotal = lineItems.reduce((s, li) => s + (Number(li.total) || 0), 0);
  const tax      = subtotal * (taxRate / 100);
  const total    = subtotal + tax;

  const onSubmit = (data: FormData) => {
    const payload = { customerId: data.customerId, subject: data.subject || null, status: data.status, paymentTerms: data.paymentTerms, notes: data.notes, dueDate: data.dueDate ? new Date(data.dueDate) : null, lineItems, subtotal: subtotal.toFixed(2), tax: tax.toFixed(2), total: total.toFixed(2) };
    if (editItem) updateMutation.mutate({ id: editItem.id, data: payload });
    else createMutation.mutate(payload);
  };

  const handlePrint = async (inv: Invoice) => {
    const customer = customers.find(c => c.id === inv.customerId);
    if (!customer) return;
    let serviceAddress = null;
    try {
      const addrs = await customersApi.getAddresses(inv.customerId);
      const primary = addrs.find((a: any) => a.isPrimary) ?? addrs[0] ?? null;
      if (primary) serviceAddress = { address: primary.address, city: primary.city, state: primary.state, zip: primary.zip };
    } catch (e) { console.error("Failed to load service address:", e); }
    setPreviewHtml(buildDocumentHtml({ type: "invoice", number: inv.invoiceNumber, title: inv.subject || undefined, status: inv.status, customer, serviceAddress, lineItems: (inv.lineItems as LineItem[]) ?? [], subtotal: inv.subtotal ?? 0, tax: inv.tax ?? 0, total: inv.total ?? 0, notes: inv.notes, createdAt: inv.createdAt, dueDate: inv.dueDate, paymentTerms: inv.paymentTerms, company: settings }));
  };

  /* Invoice status options — constrained to valid lifecycle transitions.
     Backend INVOICE_ALLOWED: draft→sent, sent→paid, sent→overdue, overdue→paid.
     paid is terminal. New invoices always start as draft. */
  const invoiceStatusOptions = (() => {
    const s = editItem?.status;
    if (!s || s === "draft") return [{ value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }];
    if (s === "sent")        return [{ value: "sent", label: "Sent" }, { value: "paid", label: "Paid" }, { value: "overdue", label: "Overdue" }];
    if (s === "overdue")     return [{ value: "overdue", label: "Overdue" }, { value: "paid", label: "Paid" }];
    return [{ value: "paid", label: "Paid" }]; // paid: terminal
  })();

  /* metrics */
  const paidTotal    = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const pendingTotal = invoices.filter(i => ["sent","draft"].includes(i.status)).reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const overdueTotal = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  const filtered = invoices.filter(inv => {
    const c = customers.find(x => x.id === inv.customerId);
    return (!search || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || (c?.name ?? "").toLowerCase().includes(search.toLowerCase()))
      && (filterStatus === "all" || inv.status === filterStatus);
  });

  return (
    <Stack spacing={3}>
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Collected"   value={formatCurrency(paidTotal)}    icon={CheckCircle2} color="green"  sub={`${invoices.filter(i => i.status === "paid").length} paid invoices`} />
        <MetricCard label="Outstanding" value={formatCurrency(pendingTotal)} icon={DollarSign}   color="blue"   sub={`${invoices.filter(i => ["sent","draft"].includes(i.status)).length} unpaid`} />
        <MetricCard label="Overdue"     value={formatCurrency(overdueTotal)} icon={AlertCircle}  color="red"    sub={`${overdueCount} invoice${overdueCount !== 1 ? "s" : ""}`} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Icon icon={Search} size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search invoices…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-card" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><Icon icon={X} size={14} /></button>}
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-40 text-sm bg-card">
            <Icon icon={SlidersHorizontal} size={14} className="mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="ml-auto h-8 bg-orange-500 hover:bg-orange-600 text-white text-sm px-3">
          <Icon icon={Plus} size={14} className="mr-1.5" /> New Invoice
        </Button>
      </div>

      {/* Table */}
      <Paper variant="outlined">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><Icon icon={Receipt} size={28} /></div>
            <p className="empty-state__title">{search || filterStatus !== "all" ? "No invoices match your filters" : "No invoices yet"}</p>
            <p className="empty-state__desc">{search || filterStatus !== "all" ? "Try a different search or clear the filters." : "Create your first invoice."}</p>
            {!search && filterStatus === "all" && <Button onClick={openCreate} className="mt-4 h-8 bg-orange-500 hover:bg-orange-600 text-white text-sm"><Icon icon={Plus} size={14} className="mr-1.5" />New Invoice</Button>}
          </div>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell padding="none" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(inv => {
                    const customer = customers.find(c => c.id === inv.customerId);
                    const isOverdue = inv.status === "overdue";
                    return (
                      <TableRow
                        key={inv.id}
                        hover={inv.status !== "paid"}
                        sx={{ cursor: inv.status !== "paid" ? "pointer" : "default", backgroundColor: isOverdue ? "rgba(239,68,68,0.04)" : undefined }}
                        onClick={() => inv.status !== "paid" && openEdit(inv)}
                      >
                        <TableCell>
                          <p className="font-semibold text-foreground font-mono text-xs">{inv.invoiceNumber}</p>
                          {inv.subject && <p className="text-xs text-muted-foreground truncate max-w-[160px]">{inv.subject}</p>}
                        </TableCell>
                        <TableCell>
                          {customer ? <div className="flex items-center gap-1.5"><Icon icon={User} size={12} className="text-muted-foreground/60" /><span className="text-sm text-foreground">{customer.name}</span></div> : <span className="text-sm text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><StatusBadge status={inv.status} /></TableCell>
                        <TableCell align="right">
                          <span className={cn("font-semibold tabular-nums", isOverdue ? "text-red-600" : "text-foreground")}>{formatCurrency(inv.total ?? "0")}</span>
                        </TableCell>
                        <TableCell sx={{ color: "text.secondary", fontSize: "0.75rem" }}>{inv.dueDate ? formatDate(inv.dueDate) : "—"}</TableCell>
                        <TableCell sx={{ color: "text.secondary", fontSize: "0.75rem" }}>{formatDate(inv.createdAt)}</TableCell>
                        <TableCell padding="none" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-7 h-7"><Icon icon={MoreVertical} size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {inv.status !== "paid" && <DropdownMenuItem onClick={() => openEdit(inv)}><Icon icon={Pencil} size={16} className="mr-2" />Edit</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => handlePrint(inv)}><Icon icon={Printer} size={16} className="mr-2" />Print / PDF</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {inv.status === "draft" && <DropdownMenuItem disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: inv.id, data: { status: "sent" } })}><Icon icon={Send} size={16} className="mr-2" />Mark as Sent</DropdownMenuItem>}
                              {["sent","overdue"].includes(inv.status) && <DropdownMenuItem disabled={markPaidMutation.isPending} onClick={() => markPaidMutation.mutate(inv.id)}><Icon icon={CheckCircle2} size={16} className="mr-2" />Mark as Paid</DropdownMenuItem>}
                              {inv.status === "sent" && <DropdownMenuItem disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ id: inv.id, data: { status: "overdue" } })}><Icon icon={AlertCircle} size={16} className="mr-2" />Mark as Overdue</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { if (confirm("Delete invoice?")) deleteMutation.mutate(inv.id); }}><Icon icon={Trash2} size={16} className="mr-2" />Delete</DropdownMenuItem>
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
              <p className="text-xs text-muted-foreground">Showing {filtered.length} of {invoices.length} invoices</p>
            </div>
          </>
        )}
      </Paper>

      <DocumentPreviewDialog html={previewHtml} title="Invoice Preview" onClose={() => setPreviewHtml(null)} />

      {/* ── Create / Edit Dialog — two-panel ── */}
      <Dialog open={dialogOpen} onOpenChange={o => !o && closeDialog()} maxWidth="xl" fullWidth>
        <DialogContent className="max-w-4xl p-0 gap-0 bg-background overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }}>
          <DialogDescription className="sr-only">Create or edit an invoice</DialogDescription>
          <DialogHeader className="px-6 py-4 bg-card border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold">
                {editItem ? `Edit Invoice ${editItem.invoiceNumber}` : "New Invoice"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={closeDialog}>Cancel</Button>
                <Button
                  size="sm"
                  className="h-8 bg-orange-500 hover:bg-orange-600 text-white min-w-[120px]"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  onClick={handleSubmit(onSubmit)}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving…" : editItem ? "Save Changes" : "Create Invoice"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-4 max-w-xl mx-auto">
              <FormSection title="Client & Subject">
                <FormField label="Client" required error={errors.customerId ? "Client is required" : undefined}>
                  <CustomerCombobox customers={customers} value={watch("customerId") ?? null} onChange={id => { setValue("customerId", id ?? (undefined as any)); setSelectedAddressId(null); }} />
                </FormField>
                <AddressSelector
                  customerId={watch("customerId")}
                  value={selectedAddressId}
                  onChange={(id) => setSelectedAddressId(id)}
                />
                <TextInput label="Subject" placeholder="e.g. Electrical Panel Upgrade" {...register("subject")} />
              </FormSection>

              <FormSection title="Status & Payment">
                <SelectInput
                  label="Status"
                  value={watch("status")}
                  onValueChange={v => setValue("status", v)}
                  options={invoiceStatusOptions}
                />
                <SelectInput
                  label="Payment Terms"
                  value={watch("paymentTerms")}
                  onValueChange={v => {
                    setValue("paymentTerms", v);
                    // Auto-suggest dueDate only when switching to a net_* term and
                    // the field is currently empty. Does not overwrite an existing date.
                    // dueDate is not recomputed automatically after creation.
                    const NET_DAYS: Record<string, number> = { net_15: 15, net_30: 30, net_60: 60 };
                    const days = NET_DAYS[v];
                    if (days !== undefined && !watch("dueDate")) {
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      setValue("dueDate", d.toISOString().slice(0, 10));
                      autoSuggestedDueDate.current = true;
                    }
                    // Clear dueDate only if it was auto-suggested (not manually entered)
                    if (v === "due_on_receipt" && autoSuggestedDueDate.current) {
                      setValue("dueDate", "");
                      autoSuggestedDueDate.current = false;
                    }
                  }}
                  options={[
                    { value: "due_on_receipt", label: "Due on Receipt" },
                    { value: "net_15",         label: "Net 15" },
                    { value: "net_30",         label: "Net 30" },
                    { value: "net_60",         label: "Net 60" },
                  ]}
                />
                <DateInput label="Due Date" hint="Auto-suggested for Net terms; always editable"
                  {...register("dueDate")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    autoSuggestedDueDate.current = false;
                    register("dueDate").onChange(e);
                  }}
                />
                <NumberInput label="Tax Rate (%)" step={0.1} min={0} max={100} placeholder="0" {...register("taxRate")} />
              </FormSection>

              <FormSection title="Line Items">
                <LineItemsEditor items={lineItems} onChange={setLineItems} taxRate={taxRate} />
              </FormSection>

              <FormSection title="Notes">
                <TextareaInput label="" rows={3} placeholder="Payment instructions, notes for the client…" {...register("notes")} />
              </FormSection>

              {editItem && (
                <FormSection title="Actions">
                  <button type="button" onClick={() => handlePrint(editItem)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors border border-border">
                    <Icon icon={Printer} size={14} className="text-muted-foreground" /> Print / Download PDF
                  </button>
                  {editItem.status === "draft" && (
                    <button type="button" onClick={() => { statusMutation.mutate({ id: editItem.id, data: { status: "sent" } }); closeDialog(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors border border-border">
                      <Icon icon={Send} size={14} className="text-muted-foreground" /> Mark as Sent
                    </button>
                  )}
                  {["sent","overdue"].includes(editItem.status) && (
                    <button type="button" onClick={() => { markPaidMutation.mutate(editItem.id); closeDialog(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-emerald-700 hover:bg-emerald-50 transition-colors border border-emerald-200">
                      <Icon icon={CheckCircle2} size={14} /> Mark as Paid
                    </button>
                  )}
                </FormSection>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
