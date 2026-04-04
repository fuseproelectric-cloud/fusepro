import { useAutoCreate } from "@/hooks/useAutoCreate";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { DocumentPreviewDialog } from "@/components/DocumentPreviewDialog";
import { LineItemsEditor } from "@/components/LineItemsEditor";
import {
  Plus, Pencil, Trash2, MoreVertical, Receipt, CheckCircle2,
  DollarSign, Printer, Send, SlidersHorizontal, User, AlertCircle,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { AddressSelector } from "@/components/AddressSelector";
import { Button } from "@/components/ui/button";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MetricCard, EmptyState, TableSkeleton, SearchInput, TableFooter, StatusBadge } from "@/components/page";
import { useInvoicesData } from "./hooks/useInvoicesData";
import { useInvoicesMutations } from "./hooks/useInvoicesMutations";

// ── Status map ────────────────────────────────────────────────────────────────

const STATUS_META = {
  draft:   { label: "Draft",   cls: "bg-muted/40 text-muted-foreground" },
  sent:    { label: "Sent",    cls: "bg-blue-100 text-blue-700" },
  paid:    { label: "Paid",    cls: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "Overdue", cls: "bg-red-100 text-red-700" },
};

// ── Container ─────────────────────────────────────────────────────────────────

export function InvoicesPageContainer() {
  const data = useInvoicesData();
  const m    = useInvoicesMutations(data.customers, data.settings);
  useAutoCreate(m.openCreate);

  const { paidTotal, pendingTotal, overdueTotal, overdueCount, paidCount, unpaidCount } = data.metrics;
  const isFiltered = !!(data.search || data.filterStatus !== "all");

  return (
    <Stack spacing={3}>
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Collected"   value={formatCurrency(paidTotal)}    icon={CheckCircle2} color="green" sub={`${paidCount} paid invoices`} />
        <MetricCard label="Outstanding" value={formatCurrency(pendingTotal)} icon={DollarSign}   color="blue"  sub={`${unpaidCount} unpaid`} />
        <MetricCard label="Overdue"     value={formatCurrency(overdueTotal)} icon={AlertCircle}  color="red"   sub={`${overdueCount} invoice${overdueCount !== 1 ? "s" : ""}`} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <SearchInput
          value={data.search}
          onChange={data.setSearch}
          placeholder="Search invoices…"
        />
        <Select value={data.filterStatus} onValueChange={data.setFilterStatus}>
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
        <Button onClick={m.openCreate} className="ml-auto h-8 bg-blue-500 hover:bg-blue-700 text-white text-sm px-3">
          <Icon icon={Plus} size={14} className="mr-1.5" /> New Invoice
        </Button>
      </div>

      {/* Table */}
      <Paper variant="outlined">
        {data.isLoading ? (
          <TableSkeleton count={4} />
        ) : data.filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={isFiltered ? "No invoices match your filters" : "No invoices yet"}
            description={isFiltered ? "Try a different search or clear the filters." : "Create your first invoice."}
            action={!isFiltered && (
              <Button onClick={m.openCreate} className="mt-4 h-8 bg-blue-500 hover:bg-blue-700 text-white text-sm">
                <Icon icon={Plus} size={14} className="mr-1.5" />New Invoice
              </Button>
            )}
          />
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
                  {data.filtered.map(inv => {
                    const customer  = data.customers.find(c => c.id === inv.customerId);
                    const isOverdue = inv.status === "overdue";
                    return (
                      <TableRow
                        key={inv.id}
                        hover={inv.status !== "paid"}
                        sx={{ cursor: inv.status !== "paid" ? "pointer" : "default", backgroundColor: isOverdue ? "rgba(239,68,68,0.04)" : undefined }}
                        onClick={() => inv.status !== "paid" && m.openEdit(inv)}
                      >
                        <TableCell>
                          <p className="font-semibold text-foreground font-mono text-xs">{inv.invoiceNumber}</p>
                          {inv.subject && <p className="text-xs text-muted-foreground truncate max-w-[160px]">{inv.subject}</p>}
                        </TableCell>
                        <TableCell>
                          {customer
                            ? <div className="flex items-center gap-1.5"><Icon icon={User} size={12} className="text-muted-foreground/60" /><span className="text-sm text-foreground">{customer.name}</span></div>
                            : <span className="text-sm text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><StatusBadge status={inv.status} map={STATUS_META} /></TableCell>
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
                              {inv.status !== "paid" && <DropdownMenuItem onClick={() => m.openEdit(inv)}><Icon icon={Pencil} size={16} className="mr-2" />Edit</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => m.handlePrint(inv)}><Icon icon={Printer} size={16} className="mr-2" />Print / PDF</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {inv.status === "draft" && <DropdownMenuItem disabled={m.statusMutation.isPending} onClick={() => m.statusMutation.mutate({ id: inv.id, data: { status: "sent" } })}><Icon icon={Send} size={16} className="mr-2" />Mark as Sent</DropdownMenuItem>}
                              {["sent","overdue"].includes(inv.status) && <DropdownMenuItem disabled={m.markPaidMutation.isPending} onClick={() => m.markPaidMutation.mutate(inv.id)}><Icon icon={CheckCircle2} size={16} className="mr-2" />Mark as Paid</DropdownMenuItem>}
                              {inv.status === "sent" && <DropdownMenuItem disabled={m.statusMutation.isPending} onClick={() => m.statusMutation.mutate({ id: inv.id, data: { status: "overdue" } })}><Icon icon={AlertCircle} size={16} className="mr-2" />Mark as Overdue</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { if (confirm("Delete invoice?")) m.deleteMutation.mutate(inv.id); }}><Icon icon={Trash2} size={16} className="mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TableFooter filtered={data.filtered.length} total={data.invoices.length} label="invoices" />
          </>
        )}
      </Paper>

      <DocumentPreviewDialog html={m.previewHtml} title="Invoice Preview" onClose={() => m.setPreviewHtml(null)} />

      {/* Create / Edit Dialog */}
      <Dialog open={m.dialogOpen} onOpenChange={o => !o && m.closeDialog()} maxWidth="md">
        <DialogContent noPadding>
          <DialogDescription className="sr-only">Create or edit an invoice</DialogDescription>
          <DialogHeader className="px-6 py-4 bg-card border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold">
                {m.editItem ? `Edit Invoice ${m.editItem.invoiceNumber}` : "New Invoice"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={m.closeDialog}>Cancel</Button>
                <Button
                  size="sm"
                  className="h-8 bg-blue-500 hover:bg-blue-700 text-white min-w-[120px]"
                  disabled={m.createMutation.isPending || m.updateMutation.isPending}
                  onClick={m.form.handleSubmit(m.onSubmit)}
                >
                  {m.createMutation.isPending || m.updateMutation.isPending ? "Saving…" : m.editItem ? "Save Changes" : "Create Invoice"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-4 max-w-xl mx-auto">
              <FormSection title="Client & Subject">
                <FormField label="Client" required error={m.form.formState.errors.customerId ? "Client is required" : undefined}>
                  <CustomerCombobox customers={data.customers} value={m.form.watch("customerId") ?? null} onChange={id => { m.form.setValue("customerId", id ?? (undefined as any)); m.setSelectedAddressId(null); }} />
                </FormField>
                <AddressSelector customerId={m.form.watch("customerId")} value={m.selectedAddressId} onChange={id => m.setSelectedAddressId(id)} />
                <TextInput label="Subject" placeholder="e.g. Electrical Panel Upgrade" {...m.form.register("subject")} />
              </FormSection>

              <FormSection title="Status & Payment">
                <SelectInput
                  label="Status"
                  value={m.form.watch("status")}
                  onValueChange={v => m.form.setValue("status", v)}
                  options={m.invoiceStatusOptions}
                />
                <SelectInput
                  label="Payment Terms"
                  value={m.form.watch("paymentTerms")}
                  onValueChange={v => {
                    m.form.setValue("paymentTerms", v);
                    const NET_DAYS: Record<string, number> = { net_15: 15, net_30: 30, net_60: 60 };
                    const days = NET_DAYS[v];
                    if (days !== undefined && !m.form.watch("dueDate")) {
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      m.form.setValue("dueDate", d.toISOString().slice(0, 10));
                      m.autoSuggestedDueDate.current = true;
                    }
                    if (v === "due_on_receipt" && m.autoSuggestedDueDate.current) {
                      m.form.setValue("dueDate", "");
                      m.autoSuggestedDueDate.current = false;
                    }
                  }}
                  options={[
                    { value: "due_on_receipt", label: "Due on Receipt" },
                    { value: "net_15",         label: "Net 15" },
                    { value: "net_30",         label: "Net 30" },
                    { value: "net_60",         label: "Net 60" },
                  ]}
                />
                <DateInput
                  label="Due Date"
                  hint="Auto-suggested for Net terms; always editable"
                  {...m.form.register("dueDate")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    m.autoSuggestedDueDate.current = false;
                    m.form.register("dueDate").onChange(e);
                  }}
                />
                <NumberInput label="Tax Rate (%)" step={0.1} min={0} max={100} placeholder="0" {...m.form.register("taxRate")} />
              </FormSection>

              <FormSection title="Line Items">
                <LineItemsEditor items={m.lineItems} onChange={m.setLineItems} taxRate={m.totals.taxRate} />
              </FormSection>

              <FormSection title="Notes">
                <TextareaInput label="" rows={3} placeholder="Payment instructions, notes for the client…" {...m.form.register("notes")} />
              </FormSection>

              {m.editItem && (
                <FormSection title="Actions">
                  <button type="button" onClick={() => m.handlePrint(m.editItem!)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors border border-border">
                    <Icon icon={Printer} size={14} className="text-muted-foreground" /> Print / Download PDF
                  </button>
                  {m.editItem.status === "draft" && (
                    <button type="button" onClick={() => { m.statusMutation.mutate({ id: m.editItem!.id, data: { status: "sent" } }); m.closeDialog(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors border border-border">
                      <Icon icon={Send} size={14} className="text-muted-foreground" /> Mark as Sent
                    </button>
                  )}
                  {["sent","overdue"].includes(m.editItem.status) && (
                    <button type="button" onClick={() => { m.markPaidMutation.mutate(m.editItem!.id); m.closeDialog(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-emerald-700 hover:bg-emerald-50 transition-colors border border-emerald-200">
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
