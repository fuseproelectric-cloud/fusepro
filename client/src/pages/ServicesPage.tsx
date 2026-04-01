import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { servicesApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, MoreVertical, Tag, Check, X, DollarSign, Receipt } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { TextInput, NumberInput, TextareaInput, SwitchInput, FormRow, FormActions } from "@/components/forms";

interface Service {
  id: number;
  name: string;
  description: string | null;
  unitPrice: string | null;
  cost: string | null;
  taxable: boolean | null;
  category: string | null;
  createdAt: string;
}

const serviceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  unitPrice: z.number({ coerce: true }).default(0),
  cost: z.number({ coerce: true }).default(0),
  taxable: z.boolean().default(true),
  category: z.string().optional(),
});

type ServiceForm = z.infer<typeof serviceSchema>;

export function ServicesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    queryFn: servicesApi.getAll,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { taxable: true, unitPrice: 0, cost: 0 },
    values: editService ? {
      name:        editService.name,
      description: editService.description ?? "",
      unitPrice:   parseFloat(editService.unitPrice ?? "0"),
      cost:        parseFloat(editService.cost ?? "0"),
      taxable:     editService.taxable ?? true,
      category:    editService.category ?? "",
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (data: ServiceForm) => servicesApi.create(data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/services"] }); closeDialog(); },
    onError: (err) => toast({ title: "Failed to create service", description: getApiErrorMessage(err), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ServiceForm> }) => servicesApi.update(id, data as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/services"] }); closeDialog(); },
    onError: (err) => toast({ title: "Failed to update service", description: getApiErrorMessage(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => servicesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/services"] }),
    onError: (err) => toast({ title: "Failed to delete service", description: getApiErrorMessage(err), variant: "destructive" }),
  });

  function openCreate() {
    setEditService(null);
    reset({ taxable: true, unitPrice: 0, cost: 0 });
    setDialogOpen(true);
  }

  function openEdit(svc: Service) {
    setEditService(svc);
    reset({
      name: svc.name,
      description: svc.description ?? "",
      unitPrice: parseFloat(svc.unitPrice ?? "0"),
      cost: parseFloat(svc.cost ?? "0"),
      taxable: svc.taxable ?? true,
      category: svc.category ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditService(null);
    reset();
  }

  const onSubmit = (data: ServiceForm) => {
    if (editService) {
      updateMutation.mutate({ id: editService.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const avgPrice = services.length > 0
    ? services.reduce((s, svc) => s + parseFloat(svc.unitPrice ?? "0"), 0) / services.length
    : 0;
  const taxableCount = services.filter(s => s.taxable).length;

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3" style={{ boxShadow: "var(--shadow-low)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-white bg-orange-500">
            <Icon icon={Tag} size={17} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none mb-1">{services.length}</p>
            <p className="text-xs font-medium text-muted-foreground">Total Services</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3" style={{ boxShadow: "var(--shadow-low)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-white bg-emerald-500">
            <Icon icon={DollarSign} size={17} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none mb-1">{formatCurrency(avgPrice)}</p>
            <p className="text-xs font-medium text-muted-foreground">Avg Price</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3" style={{ boxShadow: "var(--shadow-low)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-white bg-blue-500">
            <Icon icon={Receipt} size={17} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none mb-1">{taxableCount}</p>
            <p className="text-xs font-medium text-muted-foreground">Taxable</p>
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 flex items-start gap-3" style={{ boxShadow: "var(--shadow-low)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-white bg-muted-foreground/40">
            <Icon icon={Tag} size={17} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground leading-none mb-1">{services.length - taxableCount}</p>
            <p className="text-xs font-medium text-muted-foreground">Non-Taxable</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} className="h-8 bg-orange-500 hover:bg-orange-600 text-white text-sm px-3">
          <Icon icon={Plus} size={14} className="mr-1.5" /> New Service
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-low)" }}>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : services.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"><Icon icon={Tag} size={28} /></div>
              <p className="empty-state__title">No services yet</p>
              <p className="empty-state__desc">Add services to use as line items in estimates and invoices.</p>
              <Button onClick={openCreate} className="mt-4 h-8 bg-orange-500 hover:bg-orange-600 text-white text-sm"><Icon icon={Plus} size={14} className="mr-1.5" />New Service</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unit Price</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cost</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Taxable</th>
                    <th className="px-4 py-2.5 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {services.map((svc) => (
                    <tr key={svc.id} className="hover:bg-muted/20 group">
                      <td className="px-4 py-3 font-medium text-foreground">{svc.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                        {svc.description || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {formatCurrency(parseFloat(svc.unitPrice ?? "0"))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatCurrency(parseFloat(svc.cost ?? "0"))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {svc.category ? (
                          <Badge variant="outline" className="text-xs">
                            {svc.category}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {svc.taxable ? (
                          <Icon icon={Check} size={16} className="text-green-500" />
                        ) : (
                          <Icon icon={X} size={16} className="text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100">
                              <Icon icon={MoreVertical} size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(svc)}>
                              <Icon icon={Pencil} size={16} className="mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => { if (confirm("Delete this service?")) deleteMutation.mutate(svc.id); }}
                            >
                              <Icon icon={Trash2} size={16} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>{editService ? "Edit Service" : "New Service"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 px-6 pb-4 max-h-[75vh] overflow-y-auto">
            <TextInput label="Name" required placeholder="e.g. Electrical Panel Inspection" error={errors.name} {...register("name")} />
            <TextareaInput label="Description" rows={2} placeholder="What this service includes..." {...register("description")} />
            <FormRow cols={2}>
              <NumberInput label="Unit Price" prefix="$" step="0.01" min="0" {...register("unitPrice", { valueAsNumber: true })} />
              <NumberInput label="Cost"       prefix="$" step="0.01" min="0" {...register("cost",      { valueAsNumber: true })} />
            </FormRow>
            <TextInput label="Category" placeholder="e.g. Inspection, Installation, Repair" {...register("category")} />
            <SwitchInput label="Taxable" checked={watch("taxable") ?? true} onCheckedChange={v => setValue("taxable", v)} />
            <FormActions
              submitLabel={editService ? "Save Changes" : "Create Service"}
              loading={createMutation.isPending || updateMutation.isPending}
              onCancel={closeDialog}
            />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
