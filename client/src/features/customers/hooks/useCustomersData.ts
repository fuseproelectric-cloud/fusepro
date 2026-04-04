import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { customersApi, jobsApi, estimatesApi, invoicesApi } from "@/lib/api";
import type { Customer, Job } from "@shared/schema";

export function useCustomersData() {
  const [search, setSearch]       = useState("");
  const [sortBy, setSortBy]       = useState<"name" | "createdAt">("name");
  const [tagFilter, setTagFilter] = useState("all");

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: customersApi.getAll,
    refetchInterval: 60_000,
  });
  const { data: allJobs = [] } = useQuery<Job[]>({
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

  const allTags = useMemo(() => {
    const set = new Set<string>();
    customers.forEach(c => (c.tags ?? []).forEach((t: string) => set.add(t)));
    return Array.from(set).sort();
  }, [customers]);

  const now            = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth   = customers.filter(c => new Date(c.createdAt) >= thisMonthStart).length;
  const withJobs       = new Set(allJobs.map(j => j.customerId)).size;
  const activeCount    = customers.filter(c =>
    allJobs.some(j => j.customerId === c.id && ["scheduled", "in_progress"].includes(j.status))
  ).length;

  const filtered = useMemo(() => {
    let list = customers.filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.company ?? "").toLowerCase().includes(q)
      );
    });
    if (tagFilter !== "all") list = list.filter(c => (c.tags ?? []).includes(tagFilter));
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [customers, search, tagFilter, sortBy]);

  const getJobs      = (id: number) => allJobs.filter(j => j.customerId === id);
  const getEstimates = (id: number) => allEstimates.filter(e => e.customerId === id);
  const getInvoices  = (id: number) => allInvoices.filter(i => i.customerId === id);

  return {
    customers, isLoading,
    search, setSearch,
    sortBy, setSortBy,
    tagFilter, setTagFilter,
    filtered, allTags,
    getJobs, getEstimates, getInvoices,
    metrics: { newThisMonth, withJobs, activeCount },
  };
}
