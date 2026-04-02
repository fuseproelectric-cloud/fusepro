import { useState } from "react";
import type { Job } from "@shared/schema";

export interface JobsFiltersResult {
  search: string;
  setSearch: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterPriority: string;
  setFilterPriority: (v: string) => void;
  filtered: Job[];
}

export function useJobsFilters(jobs: Job[]): JobsFiltersResult {
  const [search, setSearch]                 = useState("");
  const [filterStatus, setFilterStatus]     = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const filtered = jobs.filter(j =>
    (!search || j.title.toLowerCase().includes(search.toLowerCase()))
    && (filterStatus === "all" || j.status === filterStatus)
    && (filterPriority === "all" || j.priority === filterPriority),
  );

  return { search, setSearch, filterStatus, setFilterStatus, filterPriority, setFilterPriority, filtered };
}
