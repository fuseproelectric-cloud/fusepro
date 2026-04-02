import { useQuery } from "@tanstack/react-query";
import { jobsApi, customersApi, techniciansApi } from "@/lib/api";
import type { Job, Customer, Technician } from "@shared/schema";

export type TechWithUser = Technician & { user?: { id: number; name: string } };

export interface JobsData {
  jobs: Job[];
  customers: Customer[];
  technicians: TechWithUser[];
  isLoading: boolean;
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
}

export function useJobsData(): JobsData {
  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    queryFn: jobsApi.getAll,
    refetchInterval: 30_000,
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: customersApi.getAll,
  });
  const { data: technicians = [] } = useQuery<TechWithUser[]>({
    queryKey: ["/api/technicians"],
    queryFn: techniciansApi.getAll,
  });

  const pendingCount    = jobs.filter(j => j.status === "pending").length;
  const inProgressCount = jobs.filter(j => ["in_progress", "assigned"].includes(j.status)).length;
  const completedCount  = jobs.filter(j => j.status === "completed").length;
  const cancelledCount  = jobs.filter(j => j.status === "cancelled").length;

  return { jobs, customers, technicians, isLoading, pendingCount, inProgressCount, completedCount, cancelledCount };
}
