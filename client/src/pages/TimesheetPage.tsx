import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fmtTime, fmtClock, fmtDateFull, fmtDayAbbr, isTodayCT, dayBoundsCT, todayStrCT } from "@/lib/time";
import { timesheetApi, myJobsApi } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/apiError";
import { getCurrentLocation } from "@/lib/gps";
import { Loader2, Play, Square, Coffee, Clock, MapPin, Truck, CheckCircle2, Wrench, ChevronRight, ChevronLeft, X, Camera, ImagePlus, DollarSign, TrendingUp, Briefcase, Car } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import Stack from "@mui/material/Stack";

type TimesheetEntry = {
  id: number;
  technicianId: number;
  jobId: number | null;
  entryType: string;
  timestamp: string;
  notes: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  jobTitle?: string | null;
};

type TodayStatus = {
  isDayStarted: boolean;
  isOnBreak: boolean;
  activeJobId: number | null;
  dayStartTime: string | null;
  totalWorkMinutesToday: number;
  totalTravelMinutesToday: number;
};

type TodayData = { entries: TimesheetEntry[]; status: TodayStatus };
type WeekDay = { date: string; entries: TimesheetEntry[]; workMinutes: number; travelMinutes: number; jobsCount: number };
type WeekData = { days: WeekDay[]; totalWorkMinutes: number; totalTravelMinutes: number; approvals?: Record<string, { approvedBy: number; approvedAt: string }> };

type Job = {
  id: number;
  title: string;
  status: string;
  scheduledAt: string | null;
  address: string | null;
  customerName?: string | null;
};

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTimestamp(ts: string): string {
  return fmtTime(ts);
}

function getEntryLabel(entry: TimesheetEntry): string {
  switch (entry.entryType) {
    case "day_start": return "Day Started";
    case "day_end": return "Day Ended";
    case "travel_start": return entry.jobTitle ? `On the Way to ${entry.jobTitle}` : "Travel Started";
    case "travel_end": return entry.jobTitle ? `Arrived at ${entry.jobTitle}` : "Arrived";
    case "work_start": return entry.jobTitle ? `Started ${entry.jobTitle}` : "Work Started";
    case "work_end": return entry.jobTitle ? `Completed ${entry.jobTitle}` : "Work Ended";
    case "break_start": return "Break Started";
    case "break_end": return "Break Ended";
    default: return entry.entryType;
  }
}

function getEntryIcon(entryType: string): string {
  switch (entryType) {
    case "day_start": return "▶";
    case "day_end": return "⏹";
    case "travel_start": return "🚗";
    case "travel_end": return "📍";
    case "work_start": return "🔧";
    case "work_end": return "✅";
    case "break_start": return "☕";
    case "break_end": return "▶";
    default: return "•";
  }
}

// Entry types that should capture GPS
const GPS_ENTRY_TYPES = new Set(["day_start", "day_end", "travel_start", "travel_end", "work_start"]);

// Job statuses that can still have timesheet actions
const ACTIVE_JOB_STATUSES = new Set(["assigned", "on_the_way", "in_progress"]);

function LiveClock() {
  const [time, setTime] = useState(new Date());
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    ref.current = setInterval(() => setTime(new Date()), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);
  return <span>{fmtClock(time)}</span>;
}

function RunningWorkTimer({ totalWorkMinutes, lastWorkStartTs }: { totalWorkMinutes: number; lastWorkStartTs: string | null }) {
  const [extra, setExtra] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!lastWorkStartTs) { setExtra(0); return; }
    const tick = () => setExtra(Math.floor((Date.now() - new Date(lastWorkStartTs).getTime()) / 60000));
    tick();
    ref.current = setInterval(tick, 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [lastWorkStartTs]);
  return <span>{formatDuration(totalWorkMinutes + (lastWorkStartTs ? extra : 0))}</span>;
}

/** Determine what action is next for a given job based on existing timesheet entries.
 *  "On the Way" is only offered if another job was already started today (not the first job). */
function getJobNextAction(jobId: number, entries: TimesheetEntry[]): "travel_start" | "travel_end" | "work_start" | "work_end" | "done" {
  const jobEntries = entries
    .filter(e => e.jobId === jobId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const has = (type: string) => jobEntries.some(e => e.entryType === type);
  const lastOf = (type: string) => jobEntries.filter(e => e.entryType === type).pop();

  const workStart = lastOf("work_start");
  const workEnd = lastOf("work_end");
  const isWorking = workStart && (!workEnd || new Date(workStart.timestamp) > new Date(workEnd.timestamp));

  if (isWorking) return "work_end";
  if (has("work_start")) return "done";
  if (has("travel_end")) return "work_start";
  if (has("travel_start")) return "travel_end";

  // First job of the day — skip travel, go straight to work_start
  const anyOtherJobWorked = entries.some(e => e.jobId !== null && e.jobId !== jobId && e.entryType === "work_start");
  if (!anyOtherJobWorked) return "work_start";

  return "travel_start";
}

// ── Work Complete Modal ───────────────────────────────────────────────────────
function WorkCompleteModal({
  jobTitle,
  workMins,
  onConfirm,
  onClose,
}: {
  jobTitle: string;
  workMins: number;
  onConfirm: (notes: string, photoUrls: string[]) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newPhotos = Array.from(files)
      .filter(f => f.type.startsWith("image/"))
      .slice(0, 10 - photos.length)
      .map(file => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const removePhoto = (idx: number) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleConfirm = async () => {
    setUploading(true);
    let photoUrls: string[] = [];
    if (photos.length > 0) {
      const fd = new FormData();
      photos.forEach(p => fd.append("photos", p.file));
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const data = await res.json();
        photoUrls = data.urls ?? [];
      } catch {
        // upload failed — proceed without photos
      }
    }
    setUploading(false);
    onConfirm(notes.trim(), photoUrls);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-high max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-foreground">Complete Work</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[260px]">{jobTitle} · {formatDuration(workMins)} logged</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground"><Icon icon={X} size={20} /></button>
        </div>

        <div className="p-5 space-y-4 pb-safe">
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Work summary (optional)</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe what was done..."
              rows={3}
              className="resize-none text-sm"
              autoFocus
            />
          </div>

          {/* Photo upload */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Photos (optional)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={p.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white"
                      onClick={() => removePhoto(i)}
                    >
                      <Icon icon={X} size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                className="flex-1 h-10 rounded-lg border-2 border-dashed border-border hover:border-blue-400 text-muted-foreground hover:text-blue-500 transition-colors flex items-center justify-center gap-2 text-sm"
                onClick={() => {
                  if (fileRef.current) {
                    fileRef.current.removeAttribute("capture");
                    fileRef.current.click();
                  }
                }}
              >
                <Icon icon={ImagePlus} size={16} /> Gallery
              </button>
              <button
                className="flex-1 h-10 rounded-lg border-2 border-dashed border-border hover:border-blue-400 text-muted-foreground hover:text-blue-500 transition-colors flex items-center justify-center gap-2 text-sm"
                onClick={() => {
                  if (fileRef.current) {
                    fileRef.current.setAttribute("capture", "environment");
                    fileRef.current.click();
                  }
                }}
              >
                <Icon icon={Camera} size={16} /> Camera
              </button>
            </div>
          </div>

          <Button
            className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold"
            onClick={handleConfirm}
            disabled={uploading}
          >
            {uploading
              ? <><Icon icon={Loader2} size={16} className="animate-spin mr-2" />Uploading...</>
              : <><Icon icon={CheckCircle2} size={16} className="mr-2" />Complete Work</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

function JobTimesheetCard({
  job,
  entries,
  onAction,
  loadingJobId,
}: {
  job: Job;
  entries: TimesheetEntry[];
  onAction: (entryType: string, jobId: number, notes?: string, photoUrls?: string[]) => void;
  loadingJobId: number | null;
}) {
  const [, navigate] = useLocation();
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const nextAction = getJobNextAction(job.id, entries);
  const isLoading = loadingJobId === job.id;
  const isFirstJob = !entries.some(e => e.jobId !== null && e.jobId !== job.id && e.entryType === "work_start");

  const jobEntries = entries
    .filter(e => e.jobId === job.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Calculate work time for this job
  let workMins = 0;
  let openWork: Date | null = null;
  for (const e of jobEntries) {
    if (e.entryType === "work_start") openWork = new Date(e.timestamp);
    else if (e.entryType === "work_end" && openWork) {
      workMins += Math.floor((new Date(e.timestamp).getTime() - openWork.getTime()) / 60000);
      openWork = null;
    }
  }
  if (openWork) workMins += Math.floor((Date.now() - openWork.getTime()) / 60000);

  const isDone = nextAction === "done";

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3",
      isDone ? "bg-green-50 border-green-200" :
      nextAction === "work_end" ? "bg-blue-50 border-blue-300" :
      "bg-card border-border"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm leading-tight">{job.title}</p>
          {job.scheduledAt && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Icon icon={Clock} size={12} />
              {fmtTime(job.scheduledAt)}
            </p>
          )}
          {job.address && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Icon icon={MapPin} size={12} className="flex-shrink-0" />
              <span className="truncate">{job.address}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {workMins > 0 && (
            <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              {formatDuration(workMins)}
            </span>
          )}
          <button
            className="text-muted-foreground/50 hover:text-muted-foreground"
            onClick={() => navigate(`/job/${job.id}`)}
          >
            <Icon icon={ChevronRight} size={16} />
          </button>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-1 text-xs">
        {(isFirstJob
          ? ["work_start", "work_end"]
          : ["travel_start", "travel_end", "work_start", "work_end"]
        ).map((step, i) => {
          const stepDone = jobEntries.some(e => e.entryType === step);
          const labels: Record<string, string> = {
            travel_start: "On Way",
            travel_end: "Arrived",
            work_start: "Working",
            work_end: "Done",
          };
          return (
            <div key={step} className="flex items-center gap-1">
              {i > 0 && <div className={cn("w-3 h-px", stepDone ? "bg-green-400" : "bg-muted/60")} />}
              <span className={cn(
                "px-1.5 py-0.5 rounded font-medium",
                stepDone ? "bg-green-100 text-green-700" : "bg-muted/40 text-muted-foreground"
              )}>
                {labels[step]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Action button */}
      {!isDone && (
        <Button
          className={cn(
            "w-full h-10 font-semibold text-sm",
            nextAction === "travel_start" ? "bg-blue-500 hover:bg-blue-600 text-white" :
            nextAction === "travel_end" ? "bg-cyan-500 hover:bg-cyan-600 text-white" :
            nextAction === "work_start" ? "bg-blue-500 hover:bg-blue-700 text-white" :
            "bg-green-600 hover:bg-green-700 text-white"
          )}
          onClick={() => {
            if (nextAction === "work_end") {
              setShowCompleteModal(true);
            } else {
              onAction(nextAction, job.id);
            }
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <><Icon icon={Loader2} size={16} className="animate-spin mr-2" />Getting location...</>
          ) : nextAction === "travel_start" ? (
            <><Icon icon={Truck} size={16} className="mr-2" />On the Way</>
          ) : nextAction === "travel_end" ? (
            <><Icon icon={MapPin} size={16} className="mr-2" />I Arrived</>
          ) : nextAction === "work_start" ? (
            <><Icon icon={Wrench} size={16} className="mr-2" />Start Work</>
          ) : (
            <><Icon icon={CheckCircle2} size={16} className="mr-2" />Complete Work</>
          )}
        </Button>
      )}

      {isDone && (
        <p className="text-xs text-green-600 font-medium text-center">
          Work completed · {formatDuration(workMins)} logged
        </p>
      )}

      {showCompleteModal && (
        <WorkCompleteModal
          jobTitle={job.title}
          workMins={workMins}
          onClose={() => setShowCompleteModal(false)}
          onConfirm={(notes, photoUrls) => {
            setShowCompleteModal(false);
            onAction("work_end", job.id, notes, photoUrls);
          }}
        />
      )}
    </div>
  );
}

// ── Earnings Tab ─────────────────────────────────────────────────────────────
type EarningsData = {
  hourlyRate: number;
  totalWorkMinutes: number;
  totalTravelMinutes: number;
  totalEarnings: number;
  jobs: Array<{ jobId: number | null; jobTitle: string; workMinutes: number; travelMinutes: number; earnings: number; date: string }>;
  daily: Array<{ date: string; workMinutes: number; travelMinutes: number; earnings: number }>;
};

const PERIODS = [
  { label: "This Week", key: "week" },
  { label: "This Month", key: "month" },
  { label: "Last Month", key: "lastmonth" },
  { label: "Custom", key: "custom" },
] as const;

function getPeriodDates(key: string): { from: string; to: string } {
  const today = new Date();
  const toStr = today.toISOString().slice(0, 10);
  if (key === "week") {
    const dow = today.getDay();
    const monday = new Date(today); monday.setDate(today.getDate() - ((dow + 6) % 7));
    return { from: monday.toISOString().slice(0, 10), to: toStr };
  }
  if (key === "month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    return { from, to: toStr };
  }
  if (key === "lastmonth") {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const from = d.toISOString().slice(0, 10);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from, to: last.toISOString().slice(0, 10) };
  }
  return { from: toStr, to: toStr };
}

function EarningsTab() {
  const [period, setPeriod] = useState<string>("week");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { from, to } = period === "custom"
    ? { from: customFrom, to: customTo }
    : getPeriodDates(period);

  const { data, isLoading } = useQuery<EarningsData>({
    queryKey: ["/api/timesheet/earnings", from, to],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/timesheet/earnings?from=${from}&to=${to}`);
      return res.json();
    },
    enabled: !!from && !!to,
    staleTime: 60_000,
  });

  const maxDayEarnings = useMemo(() => Math.max(...(data?.daily.map(d => d.earnings) ?? [1])), [data]);

  return (
    <Stack spacing={3}>
      {/* Period selector */}
      <div className="bg-card rounded-lg border border-border p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition",
                period === p.key ? "bg-blue-500 text-white" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
              )}>{p.label}</button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">From</span>
            <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
              className="border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <span className="text-xs text-muted-foreground">To</span>
            <input type="date" value={customTo} min={customFrom} max={new Date().toISOString().slice(0,10)} onChange={e => setCustomTo(e.target.value)}
              className="border border-border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Icon icon={Loader2} size={24} className="animate-spin text-blue-500" /></div>
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon={DollarSign} size={16} className="text-green-600" />
                <p className="text-xs font-medium text-green-700">Total Earned</p>
              </div>
              <p className="text-2xl font-bold text-green-700">${data.totalEarnings.toFixed(2)}</p>
              <p className="text-xs text-green-600 mt-0.5">@ ${data.hourlyRate}/hr</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon={Clock} size={16} className="text-blue-700" />
                <p className="text-xs font-medium text-blue-800">Work Hours</p>
              </div>
              <p className="text-2xl font-bold text-blue-800">{formatDuration(data.totalWorkMinutes)}</p>
              <p className="text-xs text-blue-700 mt-0.5">{data.jobs.length} jobs</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon={Car} size={16} className="text-blue-600" />
                <p className="text-xs font-medium text-blue-700">Travel Time</p>
              </div>
              <p className="text-2xl font-bold text-blue-700">{formatDuration(data.totalTravelMinutes)}</p>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon={TrendingUp} size={16} className="text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Avg per Day</p>
              </div>
              <p className="text-2xl font-bold text-foreground">
                ${data.daily.length > 0 ? (data.totalEarnings / data.daily.filter(d => d.earnings > 0).length || 0).toFixed(0) : "0"}
              </p>
            </div>
          </div>

          {/* Daily bar chart */}
          {data.daily.length > 0 && (
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Icon icon={TrendingUp} size={16} className="text-blue-500" />Daily Earnings
              </h3>
              <div className="flex items-end gap-1 h-24 overflow-x-auto pb-1">
                {data.daily.map(d => {
                  const pct = maxDayEarnings > 0 ? (d.earnings / maxDayEarnings) * 100 : 0;
                  const dayLabel = new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
                  return (
                    <div key={d.date} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 32 }}>
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap">{d.earnings > 0 ? `$${d.earnings.toFixed(0)}` : ""}</span>
                      <div className="w-6 bg-blue-100 rounded-t relative" style={{ height: 56 }}>
                        <div
                          className="absolute bottom-0 w-full bg-blue-500 rounded-t transition-all"
                          style={{ height: `${pct}%`, minHeight: d.earnings > 0 ? 2 : 0 }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap" title={dayLabel}>
                        {new Date(d.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-job breakdown */}
          {data.jobs.length > 0 && (
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Icon icon={Briefcase} size={16} className="text-blue-500" />Hours by Job
              </h3>
              <div className="space-y-2">
                {data.jobs.map((job, i) => {
                  const pct = data.totalWorkMinutes > 0 ? (job.workMinutes / data.totalWorkMinutes) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{job.jobTitle}</p>
                          <p className="text-xs text-muted-foreground">{job.date} · {formatDuration(job.workMinutes)} work{job.travelMinutes > 0 ? ` · ${formatDuration(job.travelMinutes)} travel` : ""}</p>
                        </div>
                        <p className="text-sm font-bold text-green-700 flex-shrink-0">${job.earnings.toFixed(2)}</p>
                      </div>
                      <div className="w-full bg-muted/40 rounded-full h-1.5">
                        <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.jobs.length === 0 && (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <Icon icon={DollarSign} size={40} className="text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No earnings data for this period</p>
            </div>
          )}
        </>
      )}
    </Stack>
  );
}

export function TimesheetPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = new Date();
  const [tab, setTab] = useState<"timesheet" | "earnings">("timesheet");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [jobGpsLoadingId, setJobGpsLoadingId] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Compute the anchor date for the selected week
  const weekAnchor = useMemo(() => {
    if (weekOffset === 0) return undefined;
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d.toISOString().slice(0, 10);
  }, [weekOffset]);

  const isCurrentWeek = weekOffset === 0;

  const { data: todayData, isLoading } = useQuery<TodayData>({
    queryKey: ["/api/timesheet/today"],
    queryFn: timesheetApi.getToday,
    refetchInterval: 30000,
  });

  const { data: weekData } = useQuery<WeekData>({
    queryKey: ["/api/timesheet/week", weekAnchor],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/timesheet/week${weekAnchor ? `?weekOf=${weekAnchor}` : ""}`);
      return res.json();
    },
    staleTime: isCurrentWeek ? 30_000 : 5 * 60_000,
  });

  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs/my"],
    queryFn: myJobsApi.getAll,
    refetchInterval: 30000,
  });

  // Filter today's jobs in CT timezone
  const todayJobs = useMemo(() => {
    const { start, end } = dayBoundsCT();
    return allJobs.filter(j => {
      if (!ACTIVE_JOB_STATUSES.has(j.status)) return false;
      if (!j.scheduledAt) return true;
      const d = new Date(j.scheduledAt);
      return d >= start && d < end;
    });
  }, [allJobs]);

  const entryMutation = useMutation({
    mutationFn: (data: Parameters<typeof timesheetApi.createEntry>[0]) =>
      timesheetApi.createEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/timesheet/today"] });
      qc.invalidateQueries({ queryKey: ["/api/timesheet/week"] });
      qc.invalidateQueries({ queryKey: ["/api/timesheet/earnings"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs/my"] });
      setJobGpsLoadingId(null);
    },
    onError: (err: unknown) => {
      setJobGpsLoadingId(null);
      setGpsLoading(false);
      toast({
        title: "Action failed",
        description: getApiErrorMessage(err, "Could not record timesheet entry."),
        variant: "destructive",
      });
    },
  });

  // Generic entry (day start/end, break, non-job work)
  const createEntry = async (entryType: string, jobId?: number, notes?: string) => {
    let gps: { lat?: number; lng?: number; address?: string } = {};
    if (GPS_ENTRY_TYPES.has(entryType)) {
      setGpsLoading(true);
      const loc = await getCurrentLocation();
      setGpsLoading(false);
      if (loc) gps = { lat: loc.lat, lng: loc.lng, address: loc.address };
    }
    entryMutation.mutate({ entryType, jobId, notes, ...gps });
  };

  // Job-specific entry
  const createJobEntry = async (entryType: string, jobId: number, notes?: string, photoUrls?: string[]) => {
    setJobGpsLoadingId(jobId);
    let gps: { lat?: number; lng?: number; address?: string } = {};
    if (GPS_ENTRY_TYPES.has(entryType)) {
      const loc = await getCurrentLocation();
      if (loc) gps = { lat: loc.lat, lng: loc.lng, address: loc.address };
    }
    const notesField = [notes, photoUrls?.length ? photoUrls.join(",") : null].filter(Boolean).join("\n") || undefined;
    entryMutation.mutate({ entryType, jobId, notes: notesField, ...gps });
  };

  const status = todayData?.status;
  const entries = todayData?.entries ?? [];

  const workStarts = entries.filter((e) => e.entryType === "work_start");
  const workEnds = entries.filter((e) => e.entryType === "work_end");
  const lastWorkStart = workStarts.length > 0 ? workStarts[workStarts.length - 1] : null;
  const lastWorkEnd = workEnds.length > 0 ? workEnds[workEnds.length - 1] : null;
  const isCurrentlyWorking =
    lastWorkStart !== null &&
    (lastWorkEnd === null ||
      new Date(lastWorkStart.timestamp).getTime() > new Date(lastWorkEnd.timestamp).getTime());

  function getPairDuration(entries: TimesheetEntry[], startType: string, endType: string, afterIndex: number): string | null {
    const after = entries[afterIndex];
    if (!after || after.entryType !== endType) return null;
    for (let i = afterIndex - 1; i >= 0; i--) {
      if (entries[i].entryType === startType) {
        const mins = Math.floor((new Date(after.timestamp).getTime() - new Date(entries[i].timestamp).getTime()) / 60000);
        return formatDuration(mins);
      }
    }
    return null;
  }

  const isBusy = entryMutation.isPending || gpsLoading;

  return (
    <Stack spacing={3} sx={{ maxWidth: 672, mx: "auto", pb: 5 }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Timesheet</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{fmtDateFull(today)}</p>
        </div>
        <div className="flex rounded-lg border border-border bg-card overflow-hidden">
          <button onClick={() => setTab("timesheet")}
            className={cn("px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition",
              tab === "timesheet" ? "bg-blue-500 text-white" : "text-muted-foreground hover:bg-muted/30")}>
            <Icon icon={Clock} size={14} />Hours
          </button>
          <button onClick={() => setTab("earnings")}
            className={cn("px-4 py-2 text-sm font-medium flex items-center gap-1.5 transition",
              tab === "earnings" ? "bg-blue-500 text-white" : "text-muted-foreground hover:bg-muted/30")}>
            <Icon icon={DollarSign} size={14} />Earnings
          </button>
        </div>
      </div>

      {tab === "earnings" && <EarningsTab />}
      {tab === "earnings" && null /* hide rest below */}
      {tab !== "earnings" && <>

      {/* Day Control Card */}
      <div className="bg-card rounded-lg border border-border p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Icon icon={Loader2} size={24} className="animate-spin text-blue-500" />
          </div>
        ) : !status?.isDayStarted ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-1">Ready to start your day?</p>
            <p className="text-xs text-muted-foreground mb-4 flex items-center justify-center gap-1">
              <Icon icon={MapPin} size={12} />
              GPS location will be recorded automatically
            </p>
            <Button
              className="bg-blue-500 hover:bg-blue-700 text-white h-14 text-lg px-10 font-bold rounded-lg"
              onClick={() => createEntry("day_start")}
              disabled={isBusy}
            >
              {isBusy ? (
                <>
                  <Icon icon={Loader2} size={20} className="animate-spin mr-2" />
                  {gpsLoading ? "Getting location..." : "Clocking in..."}
                </>
              ) : (
                <><Icon icon={Play} size={20} className="mr-2" />Clock In</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Day started at</p>
                <p className="font-semibold text-foreground">
                  {status.dayStartTime ? fmtTime(status.dayStartTime) : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Current time</p>
                <p className="font-mono font-bold text-foreground text-lg"><LiveClock /></p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-xs text-blue-700 font-medium">Work Time</p>
                <p className="text-lg font-bold text-blue-800">
                  <RunningWorkTimer
                    totalWorkMinutes={status.totalWorkMinutesToday}
                    lastWorkStartTs={isCurrentlyWorking && lastWorkStart ? lastWorkStart.timestamp : null}
                  />
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-xs text-blue-600 font-medium">Travel Time</p>
                <p className="text-lg font-bold text-blue-700">{formatDuration(status.totalTravelMinutesToday)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              {!status.isOnBreak ? (
                <Button
                  variant="outline"
                  className="flex-1 h-11 border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={() => createEntry("break_start")}
                  disabled={isBusy}
                >
                  <Icon icon={Coffee} size={16} className="mr-1.5" /> Start Break
                </Button>
              ) : (
                <Button
                  className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => createEntry("break_end")}
                  disabled={isBusy}
                >
                  <Icon icon={Play} size={16} className="mr-1.5" /> End Break
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 h-11 border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40"
                onClick={() => createEntry("day_end")}
                disabled={isBusy || !!status?.isOnBreak}
                title={status?.isOnBreak ? "End your break before clocking out" : undefined}
              >
                {isBusy && gpsLoading ? (
                  <><Icon icon={Loader2} size={16} className="mr-1.5 animate-spin" />Getting location...</>
                ) : (
                  <><Icon icon={Square} size={16} className="mr-1.5" />Clock Out</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Today's Jobs — timesheet actions per job */}
      {status?.isDayStarted && (
        <div className="space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Icon icon={Wrench} size={16} className="text-blue-500" />
            Today's Jobs
            {todayJobs.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">({todayJobs.length})</span>
            )}
          </h2>

          {todayJobs.length > 0 ? (
            todayJobs.map(job => (
              <JobTimesheetCard
                key={job.id}
                job={job}
                entries={entries}
                onAction={createJobEntry}
                loadingJobId={jobGpsLoadingId}
              />
            ))
          ) : (
            <div className="bg-muted/30 rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
              No jobs scheduled for today
            </div>
          )}
        </div>
      )}

      {/* Today's Timeline */}
      {entries.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-4">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Icon icon={Clock} size={16} className="text-muted-foreground" />
            Today's Activity
          </h2>
          <div className="space-y-2">
            {entries.map((entry, idx) => {
              const pairDuration =
                entry.entryType === "travel_end" ? getPairDuration(entries, "travel_start", "travel_end", idx)
                : entry.entryType === "work_end" ? getPairDuration(entries, "work_start", "work_end", idx)
                : entry.entryType === "break_end" ? getPairDuration(entries, "break_start", "break_end", idx)
                : null;

              return (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="w-6 text-center text-base flex-shrink-0 mt-0.5">{getEntryIcon(entry.entryType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{getEntryLabel(entry)}</p>
                    {entry.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Icon icon={MapPin} size={12} className="flex-shrink-0" />
                        {entry.address}
                      </p>
                    )}
                    {pairDuration && <p className="text-xs text-muted-foreground mt-0.5">{pairDuration}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">{formatTimestamp(entry.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week Summary */}
      {weekData && (
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">
              {isCurrentWeek ? "This Week" : weekData.days.length > 0 ? `Week of ${weekData.days[0].date}` : "Past Week"}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setWeekOffset(w => w - 1); setSelectedDay(null); }}
                className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-muted-foreground"
              >
                <Icon icon={ChevronLeft} size={16} />
              </button>
              {!isCurrentWeek && (
                <button
                  onClick={() => { setWeekOffset(0); setSelectedDay(null); }}
                  className="text-xs font-medium text-blue-500 hover:text-blue-700 px-1"
                >
                  Today
                </button>
              )}
              <button
                onClick={() => { setWeekOffset(w => Math.min(0, w + 1)); setSelectedDay(null); }}
                disabled={isCurrentWeek}
                className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-muted-foreground disabled:opacity-30"
              >
                <Icon icon={ChevronRight} size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-3">
            {weekData.days.map((day) => {
              const dayDate = day.date + "T12:00:00Z";
              const isToday = day.date === todayStrCT();
              const hasDayEnd = day.entries.some((e) => e.entryType === "day_end");
              const hasData = day.entries.length > 0;
              const isSelected = selectedDay === day.date;
              const isApproved = !!weekData.approvals?.[day.date];
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(isSelected ? null : day.date)}
                  className={cn(
                    "rounded-lg p-2 text-center transition-all relative",
                    isSelected ? "ring-2 ring-blue-500 ring-offset-1" : "",
                    isApproved ? "bg-green-50 border border-green-300"
                    : isToday ? "bg-blue-100 border border-blue-300"
                    : hasDayEnd ? "bg-green-50 border border-green-200"
                    : hasData ? "bg-muted/30 border border-border hover:border-border"
                    : "bg-muted/30 border border-border opacity-50"
                  )}
                >
                  {isApproved && (
                    <div className="absolute top-0.5 right-0.5">
                      <Icon icon={CheckCircle2} size={10} className="text-green-500" />
                    </div>
                  )}
                  <p className={cn("text-xs font-semibold", isApproved ? "text-green-700" : isToday ? "text-blue-800" : "text-muted-foreground")}>
                    {fmtDayAbbr(dayDate)}
                  </p>
                  {hasData ? (
                    <p className={cn("text-xs mt-1 font-medium leading-tight", isApproved ? "text-green-700" : isToday ? "text-blue-900" : "text-foreground")}>
                      {formatDuration(day.workMinutes)}
                    </p>
                  ) : (
                    <p className="text-xs mt-1 text-muted-foreground/50">—</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Day Detail */}
          {selectedDay && (() => {
            const day = weekData.days.find(d => d.date === selectedDay);
            if (!day || day.entries.length === 0) return null;
            const dayLabel = new Date(selectedDay + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
            return (
              <div className={cn("border rounded-lg p-3 mb-3", weekData.approvals?.[selectedDay] ? "bg-green-50 border-green-200" : "bg-muted/30 border-border")}>
                {weekData.approvals?.[selectedDay] && (
                  <div className="flex items-center gap-1.5 mb-2 text-green-700 text-xs font-medium">
                    <Icon icon={CheckCircle2} size={14} />Approved by manager
                  </div>
                )}
                <p className="text-xs font-semibold text-muted-foreground mb-2">{dayLabel}</p>
                <div className="space-y-2">
                  {day.entries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2">
                      <span className="text-sm flex-shrink-0 mt-0.5">{getEntryIcon(entry.entryType)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{getEntryLabel(entry)}</p>
                        {entry.address && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                            <Icon icon={MapPin} size={10} className="flex-shrink-0" />{entry.address}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">{formatTimestamp(entry.timestamp)}</span>
                    </div>
                  ))}
                </div>
                {(day.workMinutes > 0 || day.travelMinutes > 0) && (
                  <div className="flex gap-3 mt-2 pt-2 border-t border-border">
                    {day.workMinutes > 0 && <span className="text-[10px] text-blue-700 font-medium">Work: {formatDuration(day.workMinutes)}</span>}
                    {day.travelMinutes > 0 && <span className="text-[10px] text-blue-600 font-medium">Travel: {formatDuration(day.travelMinutes)}</span>}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{formatDuration(weekData.totalWorkMinutes)}</span> work
              {" + "}
              <span className="font-semibold text-foreground">{formatDuration(weekData.totalTravelMinutes)}</span> travel this week
            </p>
          </div>
        </div>
      )}
      </>}
    </Stack>
  );
}
