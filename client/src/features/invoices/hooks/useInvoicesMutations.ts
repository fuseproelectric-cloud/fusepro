import { useState, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { invoicesApi, customersApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import { buildDocumentHtml } from "@/lib/printDocument";
import type { Invoice, Customer, LineItem } from "@shared/schema";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  customerId:   z.number({ coerce: true }),
  subject:      z.string().optional(),
  status:       z.string().default("draft"),
  paymentTerms: z.string().default("due_on_receipt"),
  notes:        z.string().optional(),
  dueDate:      z.string().optional().nullable(),
  taxRate:      z.number({ coerce: true }).default(0),
});
export type InvoiceFormData = z.infer<typeof schema>;

const DEFAULT_LINE_ITEM = (): LineItem => ({
  id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, total: 0,
});

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInvoicesMutations(
  customers: Customer[],
  settings: Record<string, string>,
) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const toastErr = (title: string, err: unknown) =>
    toast({ title, description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });

  const autoSuggestedDueDate                      = useRef(false);
  const [dialogOpen, setDialogOpen]               = useState(false);
  const [editItem, setEditItem]                   = useState<Invoice | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [lineItems, setLineItems]                 = useState<LineItem[]>([DEFAULT_LINE_ITEM()]);
  const [previewHtml, setPreviewHtml]             = useState<string | null>(null);

  const form = useForm<InvoiceFormData>({
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

  const createMutation    = useMutation({ mutationFn: (d: any) => invoicesApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/invoices"] }); closeDialog(); }, onError: (err: unknown) => toastErr("Could not create invoice", err) });
  const updateMutation    = useMutation({ mutationFn: ({ id, data }: any) => invoicesApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/invoices"] }); closeDialog(); }, onError: (err: unknown) => toastErr("Could not save invoice", err) });
  const deleteMutation    = useMutation({ mutationFn: (id: number) => invoicesApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/invoices"] }), onError: (err: unknown) => toastErr("Could not delete invoice", err) });
  const statusMutation    = useMutation({ mutationFn: ({ id, data }: any) => invoicesApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/invoices"] }), onError: (err: unknown) => toastErr("Status update failed", err) });
  const markPaidMutation  = useMutation({ mutationFn: (id: number) => invoicesApi.markPaid(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/invoices"] }), onError: (err: unknown) => toastErr("Could not mark as paid", err) });

  function openCreate() {
    setEditItem(null);
    setLineItems([DEFAULT_LINE_ITEM()]);
    form.reset({ status: "draft", paymentTerms: "due_on_receipt", taxRate: 0 });
    setSelectedAddressId(null);
    autoSuggestedDueDate.current = false;
    setDialogOpen(true);
  }

  function openEdit(inv: Invoice) {
    setEditItem(inv);
    setLineItems((inv.lineItems as LineItem[]) ?? []);
    form.reset({
      customerId:   inv.customerId ?? undefined,
      subject:      inv.subject ?? "",
      status:       inv.status,
      paymentTerms: inv.paymentTerms ?? "due_on_receipt",
      notes:        inv.notes ?? "",
      dueDate:      inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : "",
      taxRate: (() => {
        const sub = parseFloat(String(inv.subtotal ?? "0"));
        const tax = parseFloat(String(inv.tax ?? "0"));
        return sub > 0 ? parseFloat(((tax / sub) * 100).toFixed(4)) : 0;
      })(),
    });
    autoSuggestedDueDate.current = false;
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditItem(null);
    form.reset();
    setSelectedAddressId(null);
    autoSuggestedDueDate.current = false;
  }

  const taxRate  = form.watch("taxRate") || 0;
  const subtotal = lineItems.reduce((s, li) => s + (Number(li.total) || 0), 0);
  const tax      = subtotal * (taxRate / 100);
  const total    = subtotal + tax;

  const onSubmit = (data: InvoiceFormData) => {
    const payload = {
      customerId:   data.customerId,
      subject:      data.subject || null,
      status:       data.status,
      paymentTerms: data.paymentTerms,
      notes:        data.notes,
      dueDate:      data.dueDate ? new Date(data.dueDate) : null,
      lineItems,
      subtotal:     subtotal.toFixed(2),
      tax:          tax.toFixed(2),
      total:        total.toFixed(2),
    };
    if (editItem) updateMutation.mutate({ id: editItem.id, data: payload });
    else          createMutation.mutate(payload);
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
    setPreviewHtml(buildDocumentHtml({
      type: "invoice", number: inv.invoiceNumber, title: inv.subject || undefined,
      status: inv.status, customer, serviceAddress,
      lineItems: (inv.lineItems as LineItem[]) ?? [],
      subtotal: inv.subtotal ?? 0, tax: inv.tax ?? 0, total: inv.total ?? 0,
      notes: inv.notes, createdAt: inv.createdAt, dueDate: inv.dueDate,
      paymentTerms: inv.paymentTerms, company: settings,
    }));
  };

  /* Invoice status options — constrained to valid lifecycle transitions */
  const invoiceStatusOptions = (() => {
    const s = editItem?.status;
    if (!s || s === "draft") return [{ value: "draft", label: "Draft" }, { value: "sent", label: "Sent" }];
    if (s === "sent")        return [{ value: "sent", label: "Sent" }, { value: "paid", label: "Paid" }, { value: "overdue", label: "Overdue" }];
    if (s === "overdue")     return [{ value: "overdue", label: "Overdue" }, { value: "paid", label: "Paid" }];
    return [{ value: "paid", label: "Paid" }];
  })();

  return {
    dialogOpen,
    editItem,
    selectedAddressId, setSelectedAddressId,
    lineItems, setLineItems,
    previewHtml, setPreviewHtml,
    form,
    autoSuggestedDueDate,
    openCreate, openEdit, closeDialog, onSubmit, handlePrint,
    invoiceStatusOptions,
    createMutation, updateMutation, deleteMutation, statusMutation, markPaidMutation,
    totals: { taxRate, subtotal, tax, total },
  };
}
