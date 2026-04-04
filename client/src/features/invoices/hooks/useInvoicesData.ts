import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invoicesApi, customersApi, settingsApi } from "@/lib/api";
import type { Invoice, Customer } from "@shared/schema";

export function useInvoicesData() {
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    queryFn: invoicesApi.getAll,
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

  const filtered = invoices.filter(inv => {
    const c = customers.find(x => x.id === inv.customerId);
    return (
      (!search ||
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        (c?.name ?? "").toLowerCase().includes(search.toLowerCase())) &&
      (filterStatus === "all" || inv.status === filterStatus)
    );
  });

  const paidTotal    = invoices.filter(i => i.status === "paid").reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const pendingTotal = invoices.filter(i => ["sent", "draft"].includes(i.status)).reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const overdueTotal = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + parseFloat(i.total ?? "0"), 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;
  const paidCount    = invoices.filter(i => i.status === "paid").length;
  const unpaidCount  = invoices.filter(i => ["sent", "draft"].includes(i.status)).length;

  return {
    invoices,
    isLoading,
    customers,
    settings,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    filtered,
    metrics: { paidTotal, pendingTotal, overdueTotal, overdueCount, paidCount, unpaidCount },
  };
}
