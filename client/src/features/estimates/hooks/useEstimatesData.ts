import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { estimatesApi, customersApi, settingsApi } from "@/lib/api";
import type { Estimate, Customer } from "@shared/schema";

export function useEstimatesData() {
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: estimates = [], isLoading } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
    queryFn: estimatesApi.getAll,
    refetchInterval: 60_000,
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: customersApi.getAll,
  });
  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
    queryFn: settingsApi.getAll,
  });

  const filtered = estimates.filter(e => {
    const c = customers.find(x => x.id === e.customerId);
    return (
      (!search ||
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        (c?.name ?? "").toLowerCase().includes(search.toLowerCase())) &&
      (filterStatus === "all" || e.status === filterStatus)
    );
  });

  const approvedTotal  = estimates.filter(e => e.status === "approved").reduce((s, e) => s + parseFloat(e.total ?? "0"), 0);
  const pendingTotal   = estimates.filter(e => ["draft", "awaiting_response"].includes(e.status)).reduce((s, e) => s + parseFloat(e.total ?? "0"), 0);
  const rejectedCount  = estimates.filter(e => ["rejected", "changes_requested"].includes(e.status)).length;
  const convertedCount = estimates.filter(e => e.status === "converted").length;
  const convRate       = estimates.length > 0 ? Math.round((convertedCount / estimates.length) * 100) : 0;

  return {
    estimates,
    isLoading,
    customers,
    settings,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filtered,
    metrics: { approvedTotal, pendingTotal, rejectedCount, convertedCount, convRate },
  };
}
