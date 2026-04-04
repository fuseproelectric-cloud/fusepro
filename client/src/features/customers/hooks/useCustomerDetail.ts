import { useQuery } from "@tanstack/react-query";
import { customersApi, jobsApi, estimatesApi, invoicesApi } from "@/lib/api";

export function useCustomerDetail(customerId: number | null) {
  const { data: customer, isLoading, isError } = useQuery<any>({
    queryKey: ["/api/customers", customerId],
    queryFn: () => customersApi.getById(customerId!),
    enabled: customerId != null,
    retry: false,
  });
  const { data: addresses = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "addresses"],
    queryFn: () => customersApi.getAddresses(customerId!),
    enabled: customerId != null,
  });
  const { data: allJobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
    queryFn: jobsApi.getAll,
  });
  const { data: allEstimates = [] } = useQuery<any[]>({
    queryKey: ["/api/estimates"],
    queryFn: estimatesApi.getAll,
  });
  const { data: allInvoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
    queryFn: invoicesApi.getAll,
  });
  const { data: custRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "requests"],
    queryFn: () => customersApi.getRequests(customerId!),
    enabled: customerId != null,
  });

  const custJobs      = allJobs.filter(j => j.customerId === customerId);
  const custEstimates = allEstimates.filter(e => e.customerId === customerId);
  const custInvoices  = allInvoices.filter(i => i.customerId === customerId);
  const outstanding   = custInvoices
    .filter(i => ["sent", "overdue"].includes(i.status))
    .reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);

  return {
    customer, isLoading, isError,
    addresses,
    custJobs, custEstimates, custInvoices, custRequests,
    outstanding,
  };
}
