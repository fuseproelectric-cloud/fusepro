import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { inventoryApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import type { InventoryItem } from "@shared/schema";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name:        z.string().min(1, "Name required"),
  sku:         z.string().optional(),
  category:    z.string().optional(),
  quantity:    z.number({ coerce: true }).default(0),
  minQuantity: z.number({ coerce: true }).default(0),
  unitCost:    z.number({ coerce: true }).default(0),
  unit:        z.string().optional(),
  location:    z.string().optional(),
});
export type InventoryFormData = z.infer<typeof schema>;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useInventoryPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch]         = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem]     = useState<InventoryItem | null>(null);

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: inventoryApi.getAll,
  });

  const form = useForm<InventoryFormData>({
    resolver: zodResolver(schema),
    values: editItem ? {
      name:        editItem.name,
      sku:         editItem.sku ?? "",
      category:    editItem.category ?? "",
      quantity:    editItem.quantity,
      minQuantity: editItem.minQuantity ?? 0,
      unitCost:    parseFloat(editItem.unitCost ?? "0"),
      unit:        editItem.unit ?? "",
      location:    editItem.location ?? "",
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (data: InventoryFormData) => inventoryApi.create(data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/inventory"] }); closeDialog(); },
    onError: (err: unknown) => toast({ title: "Failed to create item", description: getApiErrorMessage(err), variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InventoryFormData> }) => inventoryApi.update(id, data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/inventory"] }); closeDialog(); },
    onError: (err: unknown) => toast({ title: "Failed to update item", description: getApiErrorMessage(err), variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => inventoryApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/inventory"] }),
    onError: (err: unknown) => toast({ title: "Failed to delete item", description: getApiErrorMessage(err), variant: "destructive" }),
  });

  function openCreate() {
    setEditItem(null);
    form.reset({ quantity: 0, minQuantity: 0, unitCost: 0 });
    setDialogOpen(true);
  }
  function openEdit(item: InventoryItem) {
    setEditItem(item);
    form.reset({
      name: item.name, sku: item.sku ?? "", category: item.category ?? "",
      quantity: item.quantity, minQuantity: item.minQuantity ?? 0,
      unitCost: parseFloat(item.unitCost ?? "0"), unit: item.unit ?? "", location: item.location ?? "",
    });
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
    setEditItem(null);
    form.reset();
  }
  const onSubmit = (data: InventoryFormData) => {
    if (editItem) updateMutation.mutate({ id: editItem.id, data });
    else          createMutation.mutate(data);
  };

  const isLowStock = (item: InventoryItem) =>
    item.minQuantity !== null && item.minQuantity !== undefined && item.quantity <= item.minQuantity;

  const lowStockItems = items.filter(isLowStock);
  const totalValue    = items.reduce((sum, i) => sum + (i.quantity * parseFloat(i.unitCost ?? "0")), 0);
  const filtered      = items.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.sku ?? "").toLowerCase().includes(search.toLowerCase()) || (i.category ?? "").toLowerCase().includes(search.toLowerCase());
    const matchLow    = !showLowOnly || isLowStock(i);
    return matchSearch && matchLow;
  });

  return {
    items, isLoading,
    search, setSearch,
    showLowOnly, setShowLowOnly,
    dialogOpen, editItem,
    form,
    openCreate, openEdit, closeDialog, onSubmit,
    createMutation, updateMutation, deleteMutation,
    lowStockItems, totalValue, filtered,
  };
}
