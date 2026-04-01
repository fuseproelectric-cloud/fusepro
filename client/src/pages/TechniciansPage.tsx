import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { techniciansApi, usersApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { apiRequest } from "@/lib/queryClient";
import type { Technician, User } from "@shared/schema";
import { cn, formatStatus, STATUS_COLORS } from "@/lib/utils";
import {
  Plus, Pencil, Trash2, MoreVertical, Wrench, Users, UserCheck, XCircle,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { TextInput, NumberInput, SelectInput, FormRow, FormActions, type SelectOption } from "@/components/forms";

type TechWithUser = Technician & { user?: User };

// 'on_job' is intentionally excluded: the API rejects direct writes to that value
// (returns 422) because it is reserved for future job-execution automation.
// It may still appear in the read-only status display and dashboard counters.
const STATUS_OPTIONS: SelectOption[] = [
  { value: "available", label: "Available" },
  { value: "active",    label: "Active" },
  { value: "inactive",  label: "Inactive" },
];

const techSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Valid email required"),
  password: z.string().optional(),
  phone: z.string().optional(),
  skills: z.string().optional(),
  status: z.string().default("available"),
  color: z.string().optional(),
  hourlyRate: z.string().optional(),
});

type TechForm = z.infer<typeof techSchema>;

export function TechniciansPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTech, setEditTech] = useState<TechWithUser | null>(null);

  const { data: technicians = [], isLoading } = useQuery<TechWithUser[]>({
    queryKey: ["/api/technicians"],
    queryFn: techniciansApi.getAll,
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<TechForm>({
    resolver: zodResolver(techSchema),
    defaultValues: { status: "available", color: "#f97316" },
    values: editTech ? {
      name:        editTech.user?.name ?? "",
      email:       editTech.user?.email ?? "",
      phone:       editTech.phone ?? "",
      skills:      Array.isArray(editTech.skills) ? editTech.skills.join(", ") : "",
      status:      editTech.status ?? "available",
      color:       editTech.color ?? "#f97316",
      hourlyRate:  String(editTech.hourlyRate ?? "25.00"),
    } : undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (data: TechForm) => {
      // First create user, then technician
      const user = await usersApi.create({
        email: data.email,
        password: data.password || "TechPass123!",
        name: data.name,
        role: "technician",
      });
      const skills = data.skills ? data.skills.split(",").map((s) => s.trim()).filter(Boolean) : [];
      return techniciansApi.create({
        userId: user.id,
        phone: data.phone,
        skills,
        status: data.status as any,
        color: data.color || "#f97316",
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/technicians"] }); closeDialog(); },
    onError: (err: Error) => toast({ title: "Could not add technician", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TechForm }) => {
      const skills = data.skills ? data.skills.split(",").map((s) => s.trim()).filter(Boolean) : [];
      await techniciansApi.update(id, { phone: data.phone, skills, status: data.status as any, color: data.color });
      if (data.hourlyRate) {
        await apiRequest("PUT", `/api/technicians/${id}/rate`, { hourlyRate: parseFloat(data.hourlyRate) });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/technicians"] }); closeDialog(); },
    onError: (err: Error) => toast({ title: "Could not update technician", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => techniciansApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/technicians"] }),
    onError: (err: unknown) => toast({ title: "Could not delete technician", description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" }),
  });

  function openCreate() {
    setEditTech(null);
    reset({ status: "available" });
    setDialogOpen(true);
  }

  function openEdit(tech: TechWithUser) {
    setEditTech(tech);
    reset({
      name: tech.user?.name ?? "",
      email: tech.user?.email ?? "",
      phone: tech.phone ?? "",
      skills: (tech.skills ?? []).join(", "),
      status: tech.status,
      color: tech.color ?? "#f97316",
      hourlyRate: String(tech.hourlyRate ?? "25.00"),
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditTech(null);
    reset();
  }

  const onSubmit = (data: TechForm) => {
    if (editTech) {
      updateMutation.mutate({ id: editTech.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const statusOrder = ["available", "active", "inactive"];

  const available = technicians.filter(t => t.status === "available").length;
  const active    = technicians.filter(t => t.status === "active").length;
  const inactive  = technicians.filter(t => t.status === "inactive").length;

  return (
    <div className="space-y-5">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: "Total",     value: technicians.length, icon: Users,     bg: "bg-muted-foreground/40" },
          { label: "Available", value: available,           icon: UserCheck, bg: "bg-emerald-500" },
          { label: "Active",    value: active,              icon: UserCheck, bg: "bg-orange-500" },
          { label: "Inactive",  value: inactive,            icon: XCircle,   bg: "bg-muted-foreground/40" },
        ] as { label: string; value: number; icon: LucideIcon; bg: string }[]).map(({ label, value, icon, bg }) => (
          <div key={label} className="bg-card rounded-lg border border-border p-4 flex items-start gap-3" style={{ boxShadow: "var(--shadow-low)" }}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-white ${bg}`}>
              <Icon icon={icon} size={17} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none mb-1">{isLoading ? "—" : value}</p>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Icon icon={Plus} size={16} className="mr-2" />
          Add Technician
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : technicians.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="text-center py-16 text-muted-foreground">
            <Icon icon={Wrench} size={40} className="mx-auto mb-3 opacity-30" />
            <p>No technicians yet. Add your first technician.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {technicians.map((tech) => (
            <Card key={tech.id} className="bg-card border-border group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: tech.color ?? "#f97316" }}
                    >
                      {(tech.user?.name ?? "T")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{tech.user?.name ?? `Tech #${tech.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{tech.user?.email ?? ""}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100">
                        <Icon icon={MoreVertical} size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(tech)}>
                        <Icon icon={Pencil} size={16} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => { if (confirm("Delete technician?")) deleteMutation.mutate(tech.id); }}
                      >
                        <Icon icon={Trash2} size={16} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2">
                  <Badge variant="outline" className={cn("text-xs border", STATUS_COLORS[tech.status])}>
                    {formatStatus(tech.status)}
                  </Badge>
                  {tech.phone && (
                    <p className="text-xs text-muted-foreground">{tech.phone}</p>
                  )}
                  {tech.skills && tech.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tech.skills.slice(0, 3).map((skill) => (
                        <span key={skill} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          {skill}
                        </span>
                      ))}
                      {tech.skills.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{tech.skills.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>{editTech ? "Edit Technician" : "Add Technician"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 px-6 pb-4">
            {!editTech && (
              <>
                <TextInput label="Full Name" required placeholder="John Smith"        error={errors.name}  {...register("name")} />
                <TextInput label="Email"     required type="email" placeholder="john@fusepro.com" error={errors.email} {...register("email")} />
                <TextInput label="Initial Password" type="password" placeholder="Leave blank for default" {...register("password")} />
              </>
            )}
            <TextInput label="Phone"  placeholder="(555) 555-5555"                          {...register("phone")} />
            <TextInput label="Skills" placeholder="Panel upgrades, EV chargers, Rewiring"   hint="Comma-separated" {...register("skills")} />
            <FormRow cols={2}>
              <SelectInput
                label="Status"
                options={STATUS_OPTIONS}
                value={watch("status")}
                onValueChange={v => setValue("status", v)}
              />
              <TextInput label="Calendar Color" type="color" className="cursor-pointer" {...register("color")} />
            </FormRow>
            {editTech && (
              <NumberInput label="Hourly Rate" prefix="$" step="0.50" min="0" placeholder="25.00" {...register("hourlyRate")} />
            )}
            <FormActions
              submitLabel={editTech ? "Update" : "Add Technician"}
              loading={createMutation.isPending || updateMutation.isPending}
              onCancel={closeDialog}
            />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
