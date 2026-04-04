import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { myJobsApi } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentLocation } from "@/lib/gps";
import { fmtTime, fmtDateFull, fmtCompletedAt, dayBoundsCT, todayStrCT } from "@/lib/time";
import { MapPin, Clock, ChevronRight, Loader2, Truck, CheckCircle2 } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { cn, statusChipSx, priorityChipSx, formatStatus } from "@/lib/utils";
import Chip from "@mui/material/Chip";

type Job = {
  id: number;
  title: string;
  status: string;
  priority: string;
  scheduledAt: string | null;
  completedAt: string | null;
  address: string | null;
  customerName?: string | null;
  customerId: number | null;
  notes: string | null;
  description: string | null;
  technicianId: number | null;
};

type TimesheetEntry = {
  id: number;
  jobId: number | null;
  entryType: string;
  timestamp: string;
};


type FilterTab = "today" | "upcoming" | "all" | "completed";

function ElapsedTimer({ fromTs }: { fromTs: string }) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const start = new Date(fromTs).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fromTs]);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return <span className="font-mono">{h}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>;
}

async function updateJobStatus(jobId: number, status: string) {
  // Capture GPS for travel/arrival events
  const gpsStatuses = new Set(["on_the_way", "in_progress"]);
  let gps: { lat?: number; lng?: number; address?: string } = {};
  if (gpsStatuses.has(status)) {
    const loc = await getCurrentLocation();
    if (loc) gps = { lat: loc.lat, lng: loc.lng, address: loc.address };
  }
  return apiRequest("PUT", `/api/jobs/${jobId}/status`, { status, ...gps }).then((r) => r.json());
}

export function MyJobsPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>("today");
  const [gpsLoadingJobId, setGpsLoadingJobId] = useState<number | null>(null);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs/my"],
    queryFn: myJobsApi.getAll,
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery<{
    myJobsToday: number;
    myInProgress: number;
    myCompleted: number;
    myCompletedThisMonth: number;
  }>({
    queryKey: ["/api/dashboard/my-stats"],
    queryFn: myJobsApi.getMyStats,
  });

  const { data: timesheetData } = useQuery<{ entries: TimesheetEntry[]; status: any }>({
    queryKey: ["/api/timesheet/today"],
    queryFn: () => apiRequest("GET", "/api/timesheet/today").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateJobStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/jobs/my"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/my-stats"] });
      qc.invalidateQueries({ queryKey: ["/api/timesheet/today"] });
      qc.invalidateQueries({ queryKey: ["/api/timesheet/week"] });
      setGpsLoadingJobId(null);
    },
    onError: () => setGpsLoadingJobId(null),
  });

  const handleStatusUpdate = async (id: number, status: string) => {
    setGpsLoadingJobId(id);
    updateStatusMutation.mutate({ id, status });
  };

  const activeJob = jobs.find((j) => j.status === "in_progress");

  const activeJobWorkStart = activeJob
    ? (timesheetData?.entries ?? [])
        .filter((e) => e.jobId === activeJob.id && e.entryType === "work_start")
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    : null;

  function getTravelStart(jobId: number): TimesheetEntry | undefined {
    return (timesheetData?.entries ?? [])
      .filter((e) => e.jobId === jobId && e.entryType === "travel_start")
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  function filterJobs(tab: FilterTab): Job[] {
    const { start: todayStart, end: todayEnd } = dayBoundsCT();
    switch (tab) {
      case "today":
        return jobs.filter((j) => {
          if (!j.scheduledAt) return false;
          const d = new Date(j.scheduledAt);
          return d >= todayStart && d < todayEnd;
        });
      case "upcoming":
        return jobs.filter((j) => {
          if (!j.scheduledAt) return false;
          return new Date(j.scheduledAt) >= todayEnd;
        });
      case "completed":
        return jobs.filter((j) => j.status === "completed");
      case "all":
      default:
        return jobs;
    }
  }

  const filtered = filterJobs(activeTab);
  const tabs: { key: FilterTab; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "all", label: "All" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Jobs</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{fmtDateFull(new Date())}</p>
        </div>
      </div>

      {/* Active Job Banner */}
      {activeJob && (
        <div className="bg-blue-500 rounded-xl p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-blue-100 text-xs font-semibold uppercase tracking-wide mb-0.5">Active Job</p>
              <p className="font-bold text-lg leading-tight truncate">{activeJob.title}</p>
              {activeJobWorkStart && (
                <p className="text-blue-100 text-sm mt-1 font-mono">
                  <ElapsedTimer fromTs={activeJobWorkStart.timestamp} />
                </p>
              )}
            </div>
            <Button
              className="bg-card text-blue-700 hover:bg-blue-50 font-semibold h-10 flex-shrink-0"
              size="sm"
              onClick={() => navigate(`/job/${activeJob.id}`)}
            >
              Open
            </Button>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{stats?.myJobsToday ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Today</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-blue-500">{stats?.myInProgress ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">In Progress</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats?.myCompletedThisMonth ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Done This Month</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
              activeTab === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Icon icon={Loader2} size={24} className="animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-base font-medium">No jobs found</p>
          <p className="text-sm mt-1">Nothing scheduled for this view</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              travelStartEntry={job.status === "on_the_way" ? getTravelStart(job.id) : undefined}
              onStatusUpdate={handleStatusUpdate}
              isUpdating={gpsLoadingJobId === job.id || (updateStatusMutation.isPending && gpsLoadingJobId === job.id)}
              gpsLoading={gpsLoadingJobId === job.id}
              onClick={() => navigate(`/job/${job.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  travelStartEntry,
  onStatusUpdate,
  isUpdating,
  gpsLoading,
  onClick,
}: {
  job: Job;
  travelStartEntry?: TimesheetEntry;
  onStatusUpdate: (id: number, status: string) => void;
  isUpdating: boolean;
  gpsLoading: boolean;
  onClick: () => void;
}) {
  return (
    <div className={cn(
      "bg-card rounded-xl border p-4 space-y-3",
      job.status === "in_progress" ? "border-blue-400 shadow-blue-100 shadow-md" : "border-border"
    )}>
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={onClick}>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-base leading-tight">{job.title}</h3>
          {job.scheduledAt && (
            <div className="flex items-center gap-1 mt-1">
              <Icon icon={Clock} size={14} className="text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">{fmtTime(job.scheduledAt)}</span>
            </div>
          )}
          {job.status === "on_the_way" && travelStartEntry && (
            <div className="flex items-center gap-1 mt-1 text-blue-700">
              <Icon icon={Truck} size={14} className="flex-shrink-0" />
              <span className="text-sm font-medium">En Route</span>
              <span className="text-sm font-mono ml-1">
                <ElapsedTimer fromTs={travelStartEntry.timestamp} />
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <Chip size="small" label={formatStatus(job.status)} sx={statusChipSx(job.status)} />
          {job.priority && (
            <Chip size="small" label={formatStatus(job.priority)} sx={priorityChipSx(job.priority)} />
          )}
        </div>
      </div>

      {/* Customer + address */}
      <div className="space-y-1.5 cursor-pointer" onClick={onClick}>
        {job.customerName && (
          <p className="text-sm font-medium text-foreground">{job.customerName}</p>
        )}
        {job.address && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon icon={MapPin} size={14} className="flex-shrink-0" />
            <span className="truncate">{job.address}</span>
          </a>
        )}
      </div>

      {/* Action buttons */}
      {job.status === "assigned" && (
        <Button
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-semibold h-11"
          onClick={(e) => { e.stopPropagation(); onStatusUpdate(job.id, "on_the_way"); }}
          disabled={isUpdating}
        >
          {gpsLoading ? (
            <><Icon icon={Loader2} size={16} className="animate-spin mr-2" />Getting location...</>
          ) : (
            <><Icon icon={Truck} size={16} className="mr-2" />On the Way</>
          )}
        </Button>
      )}

      {job.status === "on_the_way" && (
        <Button
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-11"
          onClick={(e) => { e.stopPropagation(); onStatusUpdate(job.id, "in_progress"); }}
          disabled={isUpdating}
        >
          {gpsLoading ? (
            <><Icon icon={Loader2} size={16} className="animate-spin mr-2" />Getting location...</>
          ) : (
            <><Icon icon={CheckCircle2} size={16} className="mr-2" />Arrived – Start Job</>
          )}
        </Button>
      )}

      {job.status === "in_progress" && (
        <Button
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-semibold h-11"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          Open Job
        </Button>
      )}

      {job.status === "completed" && job.completedAt && (
        <p className="text-xs text-green-600 font-medium">
          Completed {fmtCompletedAt(job.completedAt!)}
        </p>
      )}

      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-muted-foreground" onClick={onClick}>
        View details <Icon icon={ChevronRight} size={14} />
      </button>
    </div>
  );
}
