import type { Job } from "@shared/schema";
import type { TechWithUser, Customer } from "@/lib/schedule/job-utils";
import { JobEditDialog } from "@/components/schedule/JobEditDialog";
import { CreateJobDialog } from "@/components/schedule/CreateJobDialog";

interface ScheduleDialogsProps {
  selectedJob:      Job | null;
  createForDay:     Date | null;
  createForTechId:  number | undefined;
  technicians:      TechWithUser[];
  customers:        Customer[];
  onCloseEdit:      () => void;
  onSaveEdit:       (patch: Record<string, unknown>) => Promise<void>;
  onCloseCreate:    () => void;
  onCreated:        () => void;
}

export function ScheduleDialogs({
  selectedJob, createForDay, createForTechId,
  technicians, customers,
  onCloseEdit, onSaveEdit, onCloseCreate, onCreated,
}: ScheduleDialogsProps) {
  return (
    <>
      {selectedJob && (
        <JobEditDialog
          job={selectedJob}
          technicians={technicians}
          customers={customers}
          onClose={onCloseEdit}
          onSave={onSaveEdit}
        />
      )}

      {createForDay && (
        <CreateJobDialog
          defaultDate={createForDay}
          technicians={technicians}
          customers={customers}
          defaultTechnicianId={createForTechId}
          onClose={onCloseCreate}
          onCreated={onCreated}
        />
      )}
    </>
  );
}
