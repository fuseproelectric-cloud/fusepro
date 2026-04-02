import { useQuery } from "@tanstack/react-query";
import { jobsApi, techniciansApi, customersApi } from "@/lib/api";
import type { Job } from "@shared/schema";
import type { TechWithUser, Customer } from "@/lib/schedule/job-utils";

export interface ScheduleData {
  jobs: Job[];
  technicians: TechWithUser[];
  customers: Customer[];
}

export function useScheduleData(): ScheduleData {
  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    queryFn:  jobsApi.getAll,
  });
  const { data: technicians = [] } = useQuery<TechWithUser[]>({
    queryKey: ["/api/technicians"],
    queryFn:  techniciansApi.getAll,
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn:  customersApi.getAll,
  });

  return { jobs, technicians, customers };
}
