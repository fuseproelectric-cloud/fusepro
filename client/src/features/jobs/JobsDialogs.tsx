import type { UseFormReturn } from "react-hook-form";
import type { Job, Customer } from "@shared/schema";
import type { TechWithUser } from "./hooks/useJobsData";
import type { JobFormValues } from "@/components/jobs/jobForm";
import { JobFormFields } from "@/components/jobs/JobFormFields";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface JobsDialogsProps {
  open: boolean;
  onClose: () => void;
  editJob: Job | null;
  form: UseFormReturn<JobFormValues>;
  customers: Customer[];
  technicians: TechWithUser[];
  selectedAddressId: number | null;
  onAddressIdChange: (id: number | null) => void;
  onSubmit: (data: JobFormValues) => void;
  isCreating: boolean;
  isUpdating: boolean;
}

export function JobsDialogs({
  open, onClose, editJob, form, customers, technicians,
  selectedAddressId, onAddressIdChange, onSubmit,
  isCreating, isUpdating,
}: JobsDialogsProps) {
  const isSaving = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent
        className="max-w-4xl w-full p-0 gap-0 bg-background overflow-hidden flex flex-col mx-2 sm:mx-auto"
        style={{ maxHeight: "92vh" }}
      >
        <DialogDescription className="sr-only">Create or edit a job</DialogDescription>
        <DialogHeader className="px-6 py-4 bg-card border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">
              {editJob ? `Edit Job ${editJob.jobNumber ?? `#${editJob.id}`}` : "New Job"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 bg-orange-500 hover:bg-orange-600 text-white min-w-[100px]"
                disabled={isSaving}
                onClick={form.handleSubmit(onSubmit)}
              >
                {isSaving ? "Saving…" : editJob ? "Save Changes" : "Create Job"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-4 max-w-xl mx-auto">
            <JobFormFields
              form={form}
              customers={customers}
              technicians={technicians}
              showStatus={!!editJob}
              selectedAddressId={selectedAddressId}
              onAddressIdChange={(id, _addr) => onAddressIdChange(id)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
