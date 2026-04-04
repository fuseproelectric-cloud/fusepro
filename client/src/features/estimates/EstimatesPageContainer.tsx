import { useAutoCreate } from "@/hooks/useAutoCreate";
import { formatDate, formatCurrency } from "@/lib/utils";
import { DocumentPreviewDialog } from "@/components/DocumentPreviewDialog";
import { LineItemsEditor } from "@/components/LineItemsEditor";
import {
  Plus, Pencil, Trash2, MoreVertical, FileText, X, Printer,
  Send, CheckCircle2, ThumbsDown, Receipt, Archive,
  SlidersHorizontal, TrendingUp, User,
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
import { useEstimatesData } from "./hooks/useEstimatesData";
import { useEstimatesMutations } from "./hooks/useEstimatesMutations";

// ── Status map ────────────────────────────────────────────────────────────────

const STATUS_META = {
  draft:             { label: "Draft",             cls: "bg-muted/40 text-muted-foreground" },
  awaiting_response: { label: "Awaiting Response", cls: "bg-blue-100 text-blue-700" },
  changes_requested: { label: "Changes Requested", cls: "bg-amber-100 text-amber-700" },
  approved:          { label: "Approved",          cls: "bg-emerald-100 text-emerald-700" },
  converted:         { label: "Converted",         cls: "bg-purple-100 text-purple-700" },
  archived:          { label: "Archived",          cls: "bg-muted/40 text-muted-foreground" },
};

// ── Container ─────────────────────────────────────────────────────────────────

export function EstimatesPageContainer() {
  const data = useEstimatesData();
  const m    = useEstimatesMutations(data.customers, data.settings);
  useAutoCreate(m.openCreate);

  const { approvedTotal, pendingTotal, rejectedCount, convertedCount, convRate } = data.metrics;
  const isFiltered = !!(data.search || data.filterStatus !== "all");

  return (
    <Stack spacing={3}>
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Approved Value"  value={formatCurrency(approvedTotal)} icon={CheckCircle2} color="green" />
        <MetricCard label="Pending Value"   value={formatCurrency(pendingTotal)}  icon={FileText}     color="blue" />
        <MetricCard label="Declined"        value={String(rejectedCount)}         icon={ThumbsDown}   color="red" />
        <MetricCard label="Conversion Rate" value={`${convRate}%`}               icon={TrendingUp}   color="blue" sub={`${convertedCount} converted`} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <SearchInput
          value={data.search}
          onChange={data.setSearch}
          placeholder="Search estimates…"
        />
        <Select value={data.filterStatus} onValueChange={data.setFilterStatus}>
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
        <Button onClick={m.openCreate} className="ml-auto h-8 bg-blue-500 hover:bg-blue-700 text-white text-sm px-3">
          <Icon icon={Plus} size={14} className="mr-1.5" /> New Estimate
        </Button>
      </div>

      {/* Table */}
      <Paper variant="outlined">
        {data.isLoading ? (
          <TableSkeleton count={4} />
        ) : data.filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={isFiltered ? "No estimates match your filters" : "No estimates yet"}
            description={isFiltered ? "Try a different search or clear the filters." : "Create your first estimate."}
            action={!isFiltered && (
              <Button onClick={m.openCreate} className="mt-4 h-8 bg-blue-500 hover:bg-blue-700 text-white text-sm">
                <Icon icon={Plus} size={14} className="mr-1.5" />New Estimate
              </Button>
            )}
          />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Estimate</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Valid Until</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell padding="none" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.filtered.map(est => {
                    const customer = data.customers.find(c => c.id === est.customerId);
                    return (
                      <TableRow
                        key={est.id}
                        hover={est.status !== "converted"}
                        sx={{ cursor: est.status !== "converted" ? "pointer" : "default" }}
                        onClick={() => est.status !== "converted" && est.status !== "archived" && m.openEdit(est)}
                      >
                        <TableCell>
                          <p className="font-semibold text-foreground truncate max-w-[200px]">{est.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">#{est.id}</p>
                        </TableCell>
                        <TableCell>
                          {customer
                            ? <div className="flex items-center gap-1.5"><Icon icon={User} size={12} className="text-muted-foreground/60" /><span className="text-sm text-foreground">{customer.name}</span></div>
                            : <span className="text-sm text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><StatusBadge status={est.status} map={STATUS_META} /></TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(est.total ?? "0")}</TableCell>
                        <TableCell sx={{ color: "text.secondary", fontSize: "0.75rem" }}>{est.validUntil ? formatDate(est.validUntil) : "—"}</TableCell>
                        <TableCell sx={{ color: "text.secondary", fontSize: "0.75rem" }}>{formatDate(est.createdAt)}</TableCell>
                        <TableCell padding="none" onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-7 h-7"><Icon icon={MoreVertical} size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {est.status !== "converted" && est.status !== "archived" && <DropdownMenuItem onClick={() => m.openEdit(est)}><Icon icon={Pencil} size={16} className="mr-2" />Edit</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => m.handlePrint(est)}><Icon icon={Printer} size={16} className="mr-2" />Print / PDF</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {est.status === "draft" && <DropdownMenuItem disabled={m.statusMutation.isPending} onClick={() => m.statusMutation.mutate({ id: est.id, data: { status: "awaiting_response" } })}><Icon icon={Send} size={16} className="mr-2" />Send to Client</DropdownMenuItem>}
                              {["awaiting_response", "sent"].includes(est.status) && <DropdownMenuItem disabled={m.statusMutation.isPending} onClick={() => m.statusMutation.mutate({ id: est.id, data: { status: "approved" } })}><Icon icon={CheckCircle2} size={16} className="mr-2" />Mark Approved</DropdownMenuItem>}
                              {["awaiting_response", "sent"].includes(est.status) && <DropdownMenuItem disabled={m.statusMutation.isPending} onClick={() => m.statusMutation.mutate({ id: est.id, data: { status: "changes_requested" } })}><Icon icon={ThumbsDown} size={16} className="mr-2" />Changes Requested</DropdownMenuItem>}
                              {est.status === "approved" && <DropdownMenuItem disabled={m.convertMutation.isPending} onClick={() => m.convertMutation.mutate(est)}><Icon icon={Receipt} size={16} className="mr-2" />Convert to Invoice</DropdownMenuItem>}
                              {est.status !== "archived" && <DropdownMenuItem disabled={m.statusMutation.isPending} onClick={() => m.statusMutation.mutate({ id: est.id, data: { status: "archived" } })}><Icon icon={Archive} size={16} className="mr-2" />Archive</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { if (confirm("Delete estimate?")) m.deleteMutation.mutate(est.id); }}><Icon icon={Trash2} size={16} className="mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TableFooter filtered={data.filtered.length} total={data.estimates.length} label="estimates" />
          </>
        )}
      </Paper>

      <DocumentPreviewDialog html={m.previewHtml} title="Estimate Preview" onClose={() => m.setPreviewHtml(null)} />

      {/* Create / Edit Dialog */}
      <Dialog open={m.dialogOpen} onOpenChange={o => !o && m.closeDialog()} maxWidth="md">
        <DialogContent noPadding>
          <DialogDescription className="sr-only">Create or edit an estimate</DialogDescription>
          <DialogHeader className="px-6 py-4 bg-card border-b border-border flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-bold">
                {m.editItem ? `Edit Estimate #${m.editItem.id}` : "New Estimate"}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8" onClick={m.closeDialog}>Cancel</Button>
                <Button
                  size="sm"
                  className="h-8 bg-blue-500 hover:bg-blue-700 text-white min-w-[120px]"
                  disabled={m.createMutation.isPending || m.updateMutation.isPending}
                  onClick={m.form.handleSubmit(m.onSubmit)}
                >
                  {m.createMutation.isPending || m.updateMutation.isPending ? "Saving…" : m.editItem ? "Save Changes" : "Create Estimate"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-4 max-w-xl mx-auto">
              <FormSection title="Client & Title">
                <TextInput label="Title" required placeholder="e.g. Electrical Panel Upgrade" error={m.form.formState.errors.title} {...m.form.register("title")} />
                <FormField label="Client" required error={m.form.formState.errors.customerId ? "Client is required" : undefined}>
                  <CustomerCombobox customers={data.customers} value={m.form.watch("customerId") ?? null} onChange={id => { m.form.setValue("customerId", id ?? (undefined as any)); m.setSelectedAddressId(null); }} />
                </FormField>
                <AddressSelector customerId={m.form.watch("customerId")} value={m.selectedAddressId} onChange={id => m.setSelectedAddressId(id)} />
              </FormSection>

              <FormSection title="Status & Dates">
                <SelectInput
                  label="Status"
                  value={m.form.watch("status")}
                  onValueChange={v => m.form.setValue("status", v)}
                  options={[
                    { value: "draft",             label: "Draft" },
                    { value: "awaiting_response", label: "Awaiting Response" },
                    { value: "changes_requested", label: "Changes Requested" },
                    { value: "approved",          label: "Approved" },
                    { value: "archived",          label: "Archived" },
                  ]}
                />
                <DateInput label="Valid Until" {...m.form.register("validUntil")} />
                <NumberInput label="Tax Rate (%)" step={0.1} min={0} max={100} placeholder="0" {...m.form.register("taxRate")} />
              </FormSection>

              <FormSection title="Line Items">
                <LineItemsEditor items={m.lineItems} onChange={m.setLineItems} taxRate={m.totals.taxRate} />
              </FormSection>

              <FormSection title="Notes">
                <TextareaInput label="" rows={3} placeholder="Notes visible to the client on the estimate…" {...m.form.register("notes")} />
              </FormSection>

              {m.editItem && (
                <FormSection title="Actions">
                  <button type="button" onClick={() => m.handlePrint(m.editItem!)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors border border-border">
                    <Icon icon={Printer} size={14} className="text-muted-foreground" /> Print / Download PDF
                  </button>
                  {m.editItem.status === "draft" && (
                    <button type="button" onClick={() => { m.statusMutation.mutate({ id: m.editItem!.id, data: { status: "awaiting_response" } }); m.closeDialog(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors border border-border">
                      <Icon icon={Send} size={14} className="text-muted-foreground" /> Send to Client
                    </button>
                  )}
                  {m.editItem.status === "approved" && (
                    <button type="button" onClick={() => { m.convertMutation.mutate(m.editItem!); m.closeDialog(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-emerald-700 hover:bg-emerald-50 transition-colors border border-emerald-200">
                      <Icon icon={Receipt} size={14} /> Convert to Invoice
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
