import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { inventoryApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { InventoryItem } from "@shared/schema";
import { cn, formatCurrency } from "@/lib/utils";
import { Plus, Search, Pencil, Trash2, MoreVertical, Package, AlertTriangle, DollarSign } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

const inventorySchema = z.object({
  name: z.string().min(1, "Name required"),
  sku: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number({ coerce: true }).default(0),
  minQuantity: z.number({ coerce: true }).default(0),
  unitCost: z.number({ coerce: true }).default(0),
  unit: z.string().optional(),
  location: z.string().optional(),
});

type InventoryForm = z.infer<typeof inventorySchema>;

export function InventoryPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isTechnician = user?.role === "technician";
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [showLowOnly, setShowLowOnly] = useState(false);

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: inventoryApi.getAll,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InventoryForm>({
    resolver: zodResolver(inventorySchema),
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
    mutationFn: (data: InventoryForm) => inventoryApi.create(data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/inventory"] }); closeDialog(); },
    onError: (err) => toast({ title: "Failed to create item", description: getApiErrorMessage(err), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InventoryForm> }) =>
      inventoryApi.update(id, data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/inventory"] }); closeDialog(); },
    onError: (err) => toast({ title: "Failed to update item", description: getApiErrorMessage(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => inventoryApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/inventory"] }),
    onError: (err) => toast({ title: "Failed to delete item", description: getApiErrorMessage(err), variant: "destructive" }),
  });

  function openCreate() {
    setEditItem(null);
    reset({ quantity: 0, minQuantity: 0, unitCost: 0 });
    setDialogOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditItem(item);
    reset({
      name: item.name,
      sku: item.sku ?? "",
      category: item.category ?? "",
      quantity: item.quantity,
      minQuantity: item.minQuantity ?? 0,
      unitCost: parseFloat(item.unitCost ?? "0"),
      unit: item.unit ?? "",
      location: item.location ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditItem(null);
    reset();
  }

  const onSubmit = (data: InventoryForm) => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const lowStockItems = items.filter(
    (i) => i.minQuantity !== null && i.minQuantity !== undefined && i.quantity <= i.minQuantity
  );

  const totalValue = items.reduce((sum, i) => sum + (i.quantity * parseFloat(i.unitCost ?? "0")), 0);

  const filtered = items.filter((i) => {
    const matchSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.sku ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (i.category ?? "").toLowerCase().includes(search.toLowerCase());
    const matchLow = !showLowOnly || (i.minQuantity !== null && i.minQuantity !== undefined && i.quantity <= i.minQuantity);
    return matchSearch && matchLow;
  });

  return (
    <div className="space-y-5">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3" style={{ boxShadow: "var(--shadow-low)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-white bg-muted-foreground/40">
            <Icon icon={Package} size={17} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none mb-1">{isLoading ? "—" : items.length}</p>
            <p className="text-xs font-medium text-muted-foreground">Total Items</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3" style={{ boxShadow: "var(--shadow-low)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-white bg-amber-500">
            <Icon icon={AlertTriangle} size={17} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none mb-1">{isLoading ? "—" : lowStockItems.length}</p>
            <p className="text-xs font-medium text-muted-foreground">Low Stock</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3 col-span-2 sm:col-span-1" style={{ boxShadow: "var(--shadow-low)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-white bg-emerald-500">
            <Icon icon={DollarSign} size={17} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none mb-1">{isLoading ? "—" : formatCurrency(totalValue)}</p>
            <p className="text-xs font-medium text-muted-foreground">Total Value</p>
          </div>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div
          className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg cursor-pointer"
          onClick={() => setShowLowOnly(!showLowOnly)}
        >
          <Icon icon={AlertTriangle} size={20} className="text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-400">
            <strong>{lowStockItems.length}</strong> item{lowStockItems.length > 1 ? "s" : ""} are low on stock.
            {showLowOnly ? " Showing low stock only." : " Click to filter."}
          </p>
          {showLowOnly && (
            <Button variant="ghost" size="sm" className="ml-auto text-yellow-400 h-6 text-xs">
              Show all
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Icon icon={Search} size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {!isTechnician && (
          <Button onClick={openCreate} className="bg-orange-500 hover:bg-orange-600 text-white ml-auto">
            <Icon icon={Plus} size={16} className="mr-2" />
            Add Item
          </Button>
        )}
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-low)" }}>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><Icon icon={Package} size={28} /></div>
              <p className="empty-state__title">No inventory items found</p>
              <p className="empty-state__desc">Add items to track your parts and materials.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SKU</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quantity</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unit Cost</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Location</th>
                    <th className="px-4 py-2.5 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((item) => {
                    const isLow = item.minQuantity !== null && item.minQuantity !== undefined && item.quantity <= item.minQuantity;
                    return (
                      <tr key={item.id} className="hover:bg-muted/20 group">
                        <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sku ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.category ? (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                              {item.category}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-medium", isLow ? "text-yellow-400" : "text-foreground")}>
                              {item.quantity} {item.unit ?? ""}
                            </span>
                            {isLow && <Icon icon={AlertTriangle} size={14} className="text-yellow-400" />}
                          </div>
                          {item.minQuantity !== null && item.minQuantity !== undefined && (
                            <p className="text-xs text-muted-foreground">min: {item.minQuantity}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatCurrency(item.unitCost ?? "0")}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{item.location ?? "—"}</td>
                        <td className="px-4 py-3">
                          {!isTechnician && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100">
                                  <Icon icon={MoreVertical} size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(item)}>
                                  <Icon icon={Pencil} size={16} className="mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => { if (confirm("Delete item?")) deleteMutation.mutate(item.id); }}
                                >
                                  <Icon icon={Trash2} size={16} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Item" : "Add Inventory Item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 px-6 pb-2">
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input {...register("name")} placeholder="20A Circuit Breaker" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input {...register("sku")} placeholder="CB-20A-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input {...register("category")} placeholder="Breakers, Wire, Tools..." />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" {...register("quantity")} />
              </div>
              <div className="space-y-1.5">
                <Label>Min Quantity</Label>
                <Input type="number" {...register("minQuantity")} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Cost ($)</Label>
                <Input type="number" step="0.01" {...register("unitCost")} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input {...register("unit")} placeholder="each, ft, box..." />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input {...register("location")} placeholder="Warehouse A, Shelf 3..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editItem ? "Update" : "Add Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
