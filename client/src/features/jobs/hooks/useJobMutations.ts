import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { UseFormReturn } from "react-hook-form";
import { jobsApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/hooks/use-toast";
import type { Job, InsertJob } from "@shared/schema";
import {
  jobFormSchema, JOB_FORM_DEFAULTS, mapJobToForm, buildJobPayload,
} from "@/components/jobs/jobForm";
import type { JobFormValues } from "@/components/jobs/jobForm";

type CreateVars  = Partial<InsertJob>;
type UpdateVars  = { id: number; data: Partial<InsertJob> };
type StatusVars  = { id: number; status: string };

export interface JobMutationsResult {
  // Form
  form: UseFormReturn<JobFormValues>;
  // Dialog state
  dialogOpen: boolean;
  editJob: Job | null;
  selectedAddressId: number | null;
  setSelectedAddressId: (id: number | null) => void;
  // Handlers
  openCreate: () => void;
  openEdit: (job: Job) => void;
  closeDialog: () => void;
  onSubmit: (data: JobFormValues) => void;
  // Mutation state exposed to UI
  isCreating: boolean;
  isUpdating: boolean;
  isStatusPending: boolean;
  deleteJob: (id: number) => void;
  updateStatus: (id: number, status: string) => void;
}

export function useJobMutations(): JobMutationsResult {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen]               = useState(false);
  const [editJob, setEditJob]                     = useState<Job | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: JOB_FORM_DEFAULTS,
    values: editJob ? mapJobToForm(editJob) : undefined,
  });

  const toastErr = (title: string, err: unknown) =>
    toast({ title, description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" });

  const invalidateJobs = () => {
    qc.invalidateQueries({ queryKey: ["/api/jobs"] });
    qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  };

  function openCreate() {
    setEditJob(null);
    form.reset(JOB_FORM_DEFAULTS);
    setSelectedAddressId(null);
    setDialogOpen(true);
  }

  function openEdit(job: Job) {
    setEditJob(job);
    form.reset(mapJobToForm(job));
    setSelectedAddressId(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditJob(null);
    form.reset(JOB_FORM_DEFAULTS);
    setSelectedAddressId(null);
  }

  const createMutation = useMutation<unknown, Error, CreateVars>({
    mutationFn: (d) => jobsApi.create(d),
    onSuccess: () => { invalidateJobs(); closeDialog(); },
    onError:   (err) => toastErr("Could not create job", err),
  });

  const updateMutation = useMutation<unknown, Error, UpdateVars>({
    mutationFn: ({ id, data }) => jobsApi.update(id, data),
    onSuccess: () => { invalidateJobs(); closeDialog(); },
    onError:   (err) => toastErr("Could not save job", err),
  });

  const deleteMutation = useMutation<unknown, Error, number>({
    mutationFn: (id) => jobsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/jobs"] }),
    onError:   (err) => toastErr("Could not delete job", err),
  });

  const statusMutation = useMutation<unknown, Error, StatusVars>({
    mutationFn: ({ id, status }) => jobsApi.update(id, { status }),
    onSuccess: () => invalidateJobs(),
    onError:   (err) => toastErr("Status update failed", err),
  });

  const onSubmit = (data: JobFormValues) => {
    const payload = buildJobPayload(data, { isCreate: !editJob });
    if (editJob) updateMutation.mutate({ id: editJob.id, data: payload });
    else createMutation.mutate(payload);
  };

  return {
    form,
    dialogOpen,
    editJob,
    selectedAddressId,
    setSelectedAddressId,
    openCreate,
    openEdit,
    closeDialog,
    onSubmit,
    isCreating:     createMutation.isPending,
    isUpdating:     updateMutation.isPending,
    isStatusPending: statusMutation.isPending,
    deleteJob:      (id) => deleteMutation.mutate(id),
    updateStatus:   (id, status) => statusMutation.mutate({ id, status }),
  };
}
