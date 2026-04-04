import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { customersApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import type { Customer } from "@shared/schema";

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name:       z.string().min(1, "Name is required"),
  company:    z.string().optional(),
  email:      z.string().email("Invalid email").optional().or(z.literal("")),
  phone:      z.string().optional(),
  notes:      z.string().optional(),
  tags:       z.string().optional(),
  leadSource: z.string().optional(),
});
export type CustomerFormData = z.infer<typeof schema>;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCustomersMutations() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const toastErr = (title: string, err: unknown) =>
    toast({ title, description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });

  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(schema),
    values: editCustomer ? {
      name:       editCustomer.name,
      company:    editCustomer.company ?? "",
      email:      editCustomer.email ?? "",
      phone:      editCustomer.phone ?? "",
      notes:      editCustomer.notes ?? "",
      tags:       (editCustomer.tags ?? []).join(", "),
      leadSource: editCustomer.leadSource ?? "",
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: (data: CustomerFormData) => customersApi.create({
      ...data,
      tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/customers"] }); closeDialog(); },
    onError: (err: unknown) => toastErr("Could not create customer", err),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => customersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/customers"] }); closeDialog(); },
    onError: (err: unknown) => toastErr("Could not update customer", err),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => customersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/customers"] }),
    onError: (err: unknown) => toastErr("Could not delete customer", err),
  });

  function openCreate() {
    setEditCustomer(null);
    form.reset({});
    setDialogOpen(true);
  }
  function openEdit(c: Customer) {
    setEditCustomer(c);
    form.reset({
      name:       c.name,
      company:    c.company ?? "",
      email:      c.email ?? "",
      phone:      c.phone ?? "",
      notes:      c.notes ?? "",
      tags:       (c.tags ?? []).join(", "),
      leadSource: c.leadSource ?? "",
    });
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
    setEditCustomer(null);
    form.reset();
  }
  const onSubmit = (data: CustomerFormData) => {
    const tags = data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const payload = { ...data, tags } as any;
    if (editCustomer) updateMutation.mutate({ id: editCustomer.id, data: payload });
    else              createMutation.mutate(payload);
  };

  return {
    dialogOpen, editCustomer,
    form,
    openCreate, openEdit, closeDialog, onSubmit,
    createMutation, updateMutation, deleteMutation,
  };
}
