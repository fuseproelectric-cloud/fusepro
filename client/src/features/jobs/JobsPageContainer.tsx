import { useAutoCreate } from "@/hooks/useAutoCreate";
import { useJobsData } from "./hooks/useJobsData";
import { useJobsFilters } from "./hooks/useJobsFilters";
import { useJobMutations } from "./hooks/useJobMutations";
import { JobsMetrics } from "./JobsMetrics";
import { JobsToolbar } from "./JobsToolbar";
import { JobsTable } from "./JobsTable";
import { JobsDialogs } from "./JobsDialogs";

export function JobsPageContainer() {
  const { jobs, customers, technicians, isLoading, pendingCount, inProgressCount, completedCount, cancelledCount } = useJobsData();
  const { search, setSearch, filterStatus, setFilterStatus, filterPriority, setFilterPriority, filtered } = useJobsFilters(jobs);
  const {
    form, dialogOpen, editJob, selectedAddressId, setSelectedAddressId,
    openCreate, openEdit, closeDialog, onSubmit,
    isCreating, isUpdating, isStatusPending,
    deleteJob, updateStatus,
  } = useJobMutations();

  useAutoCreate(openCreate);

  return (
    <div className="space-y-5">
      <JobsMetrics
        pendingCount={pendingCount}
        inProgressCount={inProgressCount}
        completedCount={completedCount}
        cancelledCount={cancelledCount}
      />

      <JobsToolbar
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        filterPriority={filterPriority}
        onFilterPriorityChange={setFilterPriority}
        onOpenCreate={openCreate}
      />

      <JobsTable
        isLoading={isLoading}
        jobs={jobs}
        filtered={filtered}
        customers={customers}
        technicians={technicians}
        onEdit={openEdit}
        onDelete={deleteJob}
        onStatusChange={updateStatus}
        isStatusPending={isStatusPending}
        onOpenCreate={openCreate}
        search={search}
        filterStatus={filterStatus}
      />

      <JobsDialogs
        open={dialogOpen}
        onClose={closeDialog}
        editJob={editJob}
        form={form}
        customers={customers}
        technicians={technicians}
        selectedAddressId={selectedAddressId}
        onAddressIdChange={setSelectedAddressId}
        onSubmit={onSubmit}
        isCreating={isCreating}
        isUpdating={isUpdating}
      />
    </div>
  );
}
