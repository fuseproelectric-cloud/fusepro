import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { useMutation } from "@tanstack/react-query";
import { jobsApi } from "@/lib/api";
import { getTechName } from "@/lib/schedule/job-utils";
import type { TechWithUser, Customer } from "@/lib/schedule/job-utils";
import { FormActions } from "@/components/forms";
import { jobFormSchema, buildJobPayload } from "@/components/jobs/jobForm";
import type { JobFormValues } from "@/components/jobs/jobForm";
import { JobFormFields } from "@/components/jobs/JobFormFields";

interface CreateJobDialogProps {
  defaultDate:          Date;
  technicians:          TechWithUser[];
  customers:            Customer[];
  defaultTechnicianId?: number;
  onClose:              () => void;
  onCreated:            () => void;
}

export function CreateJobDialog({
  defaultDate, technicians, customers, defaultTechnicianId, onClose, onCreated,
}: CreateJobDialogProps) {
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const startH = defaultDate.getHours() || 9;

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      title:        "",
      description:  "",
      instructions: "",
      notes:        "",
      customerId:   null,
      technicianId: defaultTechnicianId ?? null,
      status:       "pending",
      priority:     "normal",
      dateStr:      format(defaultDate, "yyyy-MM-dd"),
      timeStr:      startH === 0 ? "09:00" : format(defaultDate, "HH:mm"),
      endTimeStr:   `${String(startH + 1).padStart(2, "0")}:00`,
      address:      "",
      city:         "",
      state:        "",
      zip:          "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: JobFormValues) => {
      setSubmitError(null);
      return jobsApi.create(buildJobPayload(data, { isCreate: true }) as any);
    },
    onSuccess: () => { onCreated(); onClose(); },
    onError:   (err: any) => setSubmitError(err.message ?? "Failed to create job"),
  });

  const lockedTechnicianName = defaultTechnicianId !== undefined
    ? getTechName(technicians.find(t => t.id === defaultTechnicianId)!) || "Unknown"
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-t-2xl sm:rounded-xl w-full sm:max-w-md shadow-high max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border/60 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-bold text-foreground">New Job</h2>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-muted-foreground">
            <Icon icon={X} size={20} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={form.handleSubmit(v => createMutation.mutate(v))}
          noValidate
          className="p-5 space-y-4 pb-safe"
        >
          {submitError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <span>{submitError}</span>
            </div>
          )}

          <JobFormFields
            form={form}
            customers={customers as any}
            technicians={technicians as any}
            lockedTechnicianName={lockedTechnicianName}
            showStatus={false}
            selectedAddressId={selectedAddressId}
            onAddressIdChange={(id, _addr) => setSelectedAddressId(id)}
          />

          <FormActions
            submitLabel="Create Job"
            loadingLabel="Creating…"
            loading={createMutation.isPending}
            align="end"
          />
        </form>
      </div>
    </div>
  );
}
