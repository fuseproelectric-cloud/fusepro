import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { estimatesApi, customersApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import { buildDocumentHtml } from "@/lib/printDocument";
import type { Estimate, Customer, LineItem } from "@shared/schema";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  customerId: z.number({ coerce: true }),
  title:      z.string().min(1, "Title required"),
  status:     z.string().default("draft"),
  notes:      z.string().optional(),
  validUntil: z.string().optional().nullable(),
  taxRate:    z.number({ coerce: true }).default(0),
});
export type EstimateFormData = z.infer<typeof schema>;

const DEFAULT_LINE_ITEM = (): LineItem => ({
  id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, total: 0,
});

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEstimatesMutations(
  customers: Customer[],
  settings: Record<string, string>,
) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const toastErr = (title: string, err: unknown) =>
    toast({ title, description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });

  const [dialogOpen, setDialogOpen]               = useState(false);
  const [editItem, setEditItem]                   = useState<Estimate | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [lineItems, setLineItems]                 = useState<LineItem[]>([DEFAULT_LINE_ITEM()]);
  const [previewHtml, setPreviewHtml]             = useState<string | null>(null);

  const form = useForm<EstimateFormData>({
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

  const createMutation  = useMutation({ mutationFn: (d: any) => estimatesApi.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/estimates"] }); closeDialog(); }, onError: (err: unknown) => toastErr("Could not create estimate", err) });
  const updateMutation  = useMutation({ mutationFn: ({ id, data }: any) => estimatesApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/estimates"] }); closeDialog(); }, onError: (err: unknown) => toastErr("Could not save estimate", err) });
  const deleteMutation  = useMutation({ mutationFn: (id: number) => estimatesApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/estimates"] }), onError: (err: unknown) => toastErr("Could not delete estimate", err) });
  const statusMutation  = useMutation({ mutationFn: ({ id, data }: any) => estimatesApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/estimates"] }), onError: (err: unknown) => toastErr("Status update failed", err) });
  const convertMutation = useMutation({
    mutationFn: (est: Estimate) => estimatesApi.convertToInvoice(est.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/invoices"] }); qc.invalidateQueries({ queryKey: ["/api/estimates"] }); },
    onError: (err: unknown) => toastErr("Could not convert estimate", err),
  });

  function openCreate() {
    setEditItem(null);
    setLineItems([DEFAULT_LINE_ITEM()]);
    form.reset({ status: "draft", taxRate: 0 });
    setSelectedAddressId(null);
    setDialogOpen(true);
  }

  function openEdit(e: Estimate) {
    setEditItem(e);
    setLineItems((e.lineItems as LineItem[]) ?? []);
    form.reset({
      customerId: e.customerId ?? undefined,
      title:      e.title,
      status:     e.status,
      notes:      e.notes ?? "",
      validUntil: e.validUntil ? new Date(e.validUntil).toISOString().slice(0, 10) : "",
      taxRate: (() => {
        const sub = parseFloat(String(e.subtotal ?? "0"));
        const tax = parseFloat(String(e.tax ?? "0"));
        return sub > 0 ? parseFloat(((tax / sub) * 100).toFixed(4)) : 0;
      })(),
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditItem(null);
    form.reset();
    setSelectedAddressId(null);
  }

  const taxRate  = form.watch("taxRate") || 0;
  const subtotal = lineItems.reduce((s, li) => s + (Number(li.total) || 0), 0);
  const tax      = subtotal * (taxRate / 100);
  const total    = subtotal + tax;

  const onSubmit = (data: EstimateFormData) => {
    const payload = {
      customerId: data.customerId,
      title:      data.title,
      status:     data.status,
      notes:      data.notes,
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      lineItems,
      subtotal:   subtotal.toFixed(2),
      tax:        tax.toFixed(2),
      total:      total.toFixed(2),
    };
    if (editItem) updateMutation.mutate({ id: editItem.id, data: payload });
    else          createMutation.mutate(payload);
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
    setPreviewHtml(buildDocumentHtml({
      type: "estimate", number: String(est.id), title: est.title,
      status: est.status, customer, serviceAddress,
      lineItems: (est.lineItems as LineItem[]) ?? [],
      subtotal: est.subtotal ?? 0, tax: est.tax ?? 0, total: est.total ?? 0,
      notes: est.notes, createdAt: est.createdAt, validUntil: est.validUntil,
      company: settings,
    }));
  };

  return {
    dialogOpen,
    editItem,
    selectedAddressId, setSelectedAddressId,
    lineItems, setLineItems,
    previewHtml, setPreviewHtml,
    form,
    openCreate, openEdit, closeDialog, onSubmit, handlePrint,
    createMutation, updateMutation, deleteMutation, statusMutation, convertMutation,
    totals: { taxRate, subtotal, tax, total },
  };
}
