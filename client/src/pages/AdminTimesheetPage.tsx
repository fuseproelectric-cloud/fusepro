import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Car,
  MapPin,
  Search,
  Download,
  FileText,
  CheckCircle2,
  User,
  Pencil,
  Trash2,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { TextInput, TextareaInput, SelectInput, DateInput, FormActions, type SelectOption } from "@/components/forms";
import { cn } from "@/lib/utils";
import { TechnicianMap } from "@/components/TechnicianMap";

interface TimesheetEntry {
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
}

interface TechTimesheetData {
  technicianId: number;
  technicianName: string;
  technicianColor: string;
  entries: TimesheetEntry[];
}

import { fmtTime, fmtDateFull, dateStrCT, todayStrCT } from "@/lib/time";
import Stack from "@mui/material/Stack";

function formatTime(ts: string) { return fmtTime(ts); }
function formatDateISO(d: Date) { return dateStrCT(d); }
function formatDateLabel(d: Date) { return fmtDateFull(d); }

function fmtMins(mins: number) {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function calcStats(entries: TimesheetEntry[], now: Date) {
  const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let workMinutes = 0, travelMinutes = 0;
  let openWork: Date | null = null, openTravel: Date | null = null;
  const jobIds = new Set<number>();
  const dayStarts = sorted.filter(e => e.entryType === "day_start");
  const dayEnds = sorted.filter(e => e.entryType === "day_end");
  const isDayStarted = dayStarts.length > dayEnds.length;
  const dayStartTime = dayStarts.length > 0 ? new Date(dayStarts[0].timestamp) : null;
  const dayEndTime = dayEnds.length > 0 ? new Date(dayEnds[dayEnds.length - 1].timestamp) : null;
  const breakStarts = sorted.filter(e => e.entryType === "break_start");
  const breakEnds = sorted.filter(e => e.entryType === "break_end");
  const isOnBreak = breakStarts.length > breakEnds.length;
  for (const e of sorted) {
    if (e.jobId) jobIds.add(e.jobId);
    if (e.entryType === "work_start") openWork = new Date(e.timestamp);
    else if (e.entryType === "work_end" && openWork) {
      workMinutes += Math.floor((new Date(e.timestamp).getTime() - openWork.getTime()) / 60000);
      openWork = null;
    }
    if (e.entryType === "travel_start") openTravel = new Date(e.timestamp);
    else if (e.entryType === "travel_end" && openTravel) {
      travelMinutes += Math.floor((new Date(e.timestamp).getTime() - openTravel.getTime()) / 60000);
      openTravel = null;
    }
  }
  if (openWork) workMinutes += Math.floor((now.getTime() - openWork.getTime()) / 60000);
  if (openTravel) travelMinutes += Math.floor((now.getTime() - openTravel.getTime()) / 60000);
  return { workMinutes, travelMinutes, jobsCount: jobIds.size, isDayStarted, dayStartTime, dayEndTime, isOnBreak };
}

const ENTRY_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  day_start:    { label: "Day Started",    emoji: "▶",  color: "text-green-700",  bg: "bg-green-50 border-green-200" },
  day_end:      { label: "Day Ended",      emoji: "⏹",  color: "text-muted-foreground",  bg: "bg-muted/30 border-border" },
  travel_start: { label: "Travel Started", emoji: "🚗", color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  travel_end:   { label: "Arrived",        emoji: "📍", color: "text-blue-600",   bg: "bg-blue-50 border-blue-100" },
  work_start:   { label: "Work Started",   emoji: "🔧", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  work_end:     { label: "Work Completed", emoji: "✅", color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
  break_start:  { label: "Break Started",  emoji: "☕", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  break_end:    { label: "Break Ended",    emoji: "▶",  color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
};

// ── Edit Entry Modal ──────────────────────────────────────────────────────────
const ENTRY_TYPES = ["day_start","day_end","travel_start","travel_end","work_start","work_end","break_start","break_end"];

function EditEntryModal({ entry, onClose, onSave }: {
  entry: TimesheetEntry;
  onClose: () => void;
  onSave: (id: number, data: { entryType: string; timestamp: string; notes: string }) => void;
}) {
  const ts = new Date(entry.timestamp);
  // local datetime-local string: "2026-03-17T08:30"
  const localStr = new Date(ts.getTime() - ts.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [entryType, setEntryType] = useState(entry.entryType);
  const [datetime, setDatetime] = useState(localStr);
  const [notes, setNotes] = useState(entry.notes ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-high w-full max-w-sm mx-4 p-5 space-y-4">
        <h3 className="font-semibold text-foreground">Edit Entry</h3>
        <SelectInput
          label="Entry Type"
          options={ENTRY_TYPES.map(t => ({ value: t, label: ENTRY_CONFIG[t]?.label ?? t }))}
          value={entryType}
          onValueChange={setEntryType}
        />
        <DateInput
          label="Date & Time"
          variant="datetime-local"
          value={datetime}
          onChange={e => setDatetime((e.target as HTMLInputElement).value)}
        />
        <TextareaInput
          label="Notes"
          rows={2}
          placeholder="Optional notes"
          value={notes}
          onChange={e => setNotes((e.target as HTMLTextAreaElement).value)}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 h-9" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            className="flex-1 h-9 bg-orange-500 hover:bg-orange-600 text-white font-medium"
            onClick={() => onSave(entry.id, { entryType, timestamp: new Date(datetime).toISOString(), notes })}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function EntryRow({ entry, onEdit, onDelete }: {
  entry: TimesheetEntry;
  onEdit?: (entry: TimesheetEntry) => void;
  onDelete?: (id: number) => void;
}) {
  const cfg = ENTRY_CONFIG[entry.entryType] ?? { label: entry.entryType.replace(/_/g, " "), emoji: "•", color: "text-muted-foreground", bg: "bg-muted/30 border-border" };
  return (
    <div className={cn("flex items-start gap-3 px-3 py-2 rounded-lg border text-sm group", cfg.bg)}>
      <span className="text-base flex-shrink-0 mt-0.5">{cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <span className={cn("font-medium", cfg.color)}>{cfg.label}</span>
        {entry.address && <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground/60"><Icon icon={MapPin} size={12} className="flex-shrink-0" /><span>{entry.address}</span></div>}
        {entry.notes && <p className="text-muted-foreground/60 text-xs mt-0.5">{entry.notes}</p>}
      </div>
      <span className="text-muted-foreground text-xs flex-shrink-0 font-mono whitespace-nowrap">{formatTime(entry.timestamp)}</span>
      {(onEdit || onDelete) && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {onEdit && (
            <button onClick={() => onEdit(entry)}
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/60 hover:text-orange-500 hover:bg-card/70">
              <Icon icon={Pencil} size={12} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => { if (confirm("Delete this entry?")) onDelete(entry.id); }}
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/60 hover:text-red-500 hover:bg-card/70">
              <Icon icon={Trash2} size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function calcJobMins(entries: TimesheetEntry[], now: Date) {
  let workMins = 0, travelMins = 0;
  let openWork: Date | null = null, openTravel: Date | null = null;
  for (const e of entries) {
    if (e.entryType === "work_start") openWork = new Date(e.timestamp);
    else if (e.entryType === "work_end" && openWork) { workMins += Math.floor((new Date(e.timestamp).getTime() - openWork.getTime()) / 60000); openWork = null; }
    if (e.entryType === "travel_start") openTravel = new Date(e.timestamp);
    else if (e.entryType === "travel_end" && openTravel) { travelMins += Math.floor((new Date(e.timestamp).getTime() - openTravel.getTime()) / 60000); openTravel = null; }
  }
  if (openWork) workMins += Math.floor((now.getTime() - openWork.getTime()) / 60000);
  if (openTravel) travelMins += Math.floor((now.getTime() - openTravel.getTime()) / 60000);
  return { workMins, travelMins };
}

const JOB_ENTRY_TYPES = new Set(["travel_start", "travel_end", "work_start", "work_end"]);

function EntryGroups({ entries, onEdit, onDelete }: {
  entries: TimesheetEntry[];
  onEdit?: (entry: TimesheetEntry) => void;
  onDelete?: (id: number) => void;
}) {
  const now = new Date();
  const generalEntries = entries.filter(e => !JOB_ENTRY_TYPES.has(e.entryType));
  const jobEntries = entries.filter(e => JOB_ENTRY_TYPES.has(e.entryType));
  const jobGroups = new Map<number | null, { title: string | null; entries: TimesheetEntry[] }>();
  for (const e of jobEntries) {
    const key = e.jobId ?? null;
    if (!jobGroups.has(key)) jobGroups.set(key, { title: e.jobTitle ?? null, entries: [] });
    jobGroups.get(key)!.entries.push(e);
  }
  return (
    <div className="space-y-4">
      {generalEntries.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">Day Activity</p>
          {generalEntries.map(e => <EntryRow key={e.id} entry={e} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      )}
      {[...jobGroups.entries()].map(([jobId, group]) => {
        const { workMins, travelMins } = calcJobMins(group.entries, now);
        return (
          <div key={jobId ?? "no-job"} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Icon icon={Briefcase} size={14} className="text-orange-500 flex-shrink-0" />
              <p className="text-xs font-semibold text-muted-foreground flex-1 truncate">{group.title ?? (jobId ? `Job #${jobId}` : "Unlinked")}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                {travelMins > 0 && <span className="text-xs text-blue-500 font-medium flex items-center gap-1"><Icon icon={Car} size={12} />{fmtMins(travelMins)}</span>}
                {workMins > 0 && <span className="text-xs text-orange-500 font-medium flex items-center gap-1"><Icon icon={Clock} size={12} />{fmtMins(workMins)}</span>}
              </div>
            </div>
            {group.entries.map(e => <EntryRow key={e.id} entry={e} onEdit={onEdit} onDelete={onDelete} />)}
          </div>
        );
      })}
    </div>
  );
}

function TechCard({ tech, now }: { tech: TechTimesheetData; now: Date }) {
  const [expanded, setExpanded] = useState(false);
  const stats = useMemo(() => calcStats(tech.entries, now), [tech.entries, now]);
  const sorted = useMemo(() => [...tech.entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()), [tech.entries]);
  const statusColor = stats.isDayStarted ? (stats.isOnBreak ? "bg-yellow-400" : "bg-green-500") : "bg-muted/60";
  const statusLabel = stats.isDayStarted ? (stats.isOnBreak ? "On Break" : "Active") : "Inactive";
  const startEntry = sorted.find(e => e.entryType === "day_start" && e.lat);
  const endEntry = [...sorted].reverse().find(e => e.entryType === "day_end" && e.lat);
  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: tech.technicianColor }}>
            {tech.technicianName.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground text-sm">{tech.technicianName}</span>
              <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColor)} />
              <span className="text-xs text-muted-foreground">{statusLabel}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
              {stats.dayStartTime ? (
                <div className="flex items-center gap-1">
                  <Icon icon={Clock} size={12} />
                  <span>Started {formatTime(stats.dayStartTime.toISOString())}{stats.dayEndTime && <> · Ended {formatTime(stats.dayEndTime.toISOString())}</>}</span>
                </div>
              ) : <span>No activity today</span>}
              {startEntry?.address && <div className="flex items-center gap-1 text-green-700"><Icon icon={MapPin} size={12} className="flex-shrink-0" /><span className="truncate">Start: {startEntry.address}</span></div>}
              {endEntry?.address && <div className="flex items-center gap-1 text-muted-foreground"><Icon icon={MapPin} size={12} className="flex-shrink-0" /><span className="truncate">End: {endEntry.address}</span></div>}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <Badge variant="outline" className="text-xs border-orange-200 text-orange-600 bg-orange-50"><Icon icon={Briefcase} size={12} className="mr-1" />{fmtMins(stats.workMinutes)}</Badge>
            <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 bg-blue-50"><Icon icon={Car} size={12} className="mr-1" />{fmtMins(stats.travelMinutes)}</Badge>
            {stats.jobsCount > 0 && <Badge variant="outline" className="text-xs border-border text-muted-foreground">{stats.jobsCount} job{stats.jobsCount !== 1 ? "s" : ""}</Badge>}
          </div>
          <button className="ml-2 text-muted-foreground/60">{expanded ? <Icon icon={ChevronUp} size={16} /> : <Icon icon={ChevronDown} size={16} />}</button>
        </div>
        <div className="flex sm:hidden items-center gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className="text-xs border-orange-200 text-orange-600 bg-orange-50"><Icon icon={Briefcase} size={12} className="mr-1" /> {fmtMins(stats.workMinutes)}</Badge>
          <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 bg-blue-50"><Icon icon={Car} size={12} className="mr-1" /> {fmtMins(stats.travelMinutes)}</Badge>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {sorted.length === 0 ? <p className="text-sm text-muted-foreground/60 py-2 text-center">No entries for this day</p> : <EntryGroups entries={sorted} />}
        </CardContent>
      )}
    </Card>
  );
}

// ── Report Mode ────────────────────────────────────────────────────────────────
function ReportView({ from, to }: { from: string; to: string }) {
  const now = new Date();
  const { data, isLoading } = useQuery<TechTimesheetData[]>({
    queryKey: ["/api/admin/timesheets/report", from, to],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/timesheets/report?from=${from}&to=${to}`);
      return res.json();
    },
    enabled: !!from && !!to,
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.map(tech => {
      const s = calcStats(tech.entries, now);
      const jobIds = new Set(tech.entries.filter(e => e.jobId).map(e => e.jobId));
      // Group entries by date
      const byDate: Record<string, TimesheetEntry[]> = {};
      for (const e of tech.entries) {
        const d = e.timestamp.slice(0, 10);
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(e);
      }
      return { tech, stats: s, jobsCount: jobIds.size, byDate };
    }).filter(r => r.stats.workMinutes > 0 || r.stats.travelMinutes > 0 || r.tech.entries.length > 0);
  }, [data]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    work: acc.work + r.stats.workMinutes,
    travel: acc.travel + r.stats.travelMinutes,
    jobs: acc.jobs + r.jobsCount,
  }), { work: 0, travel: 0, jobs: 0 }), [rows]);

  function exportCSV() {
    if (!data) return;
    const lines: string[] = ["Technician,Date,Work (min),Travel (min),Jobs,Clock In,Clock Out"];
    for (const tech of data) {
      const byDate: Record<string, TimesheetEntry[]> = {};
      for (const e of tech.entries) {
        const d = e.timestamp.slice(0, 10);
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(e);
      }
      for (const [date, entries] of Object.entries(byDate).sort()) {
        const s = calcStats(entries, now);
        const clockIn = entries.find(e => e.entryType === "day_start");
        const clockOut = [...entries].reverse().find(e => e.entryType === "day_end");
        const jobIds = new Set(entries.filter(e => e.jobId).map(e => e.jobId));
        lines.push([
          `"${tech.technicianName}"`, date,
          s.workMinutes, s.travelMinutes, jobIds.size,
          clockIn ? formatTime(clockIn.timestamp) : "",
          clockOut ? formatTime(clockOut.timestamp) : "",
        ].join(","));
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `timesheets_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Work</p>
            <p className="text-2xl font-bold text-orange-600">{fmtMins(totals.work)}</p>
            <p className="text-xs text-muted-foreground/60">{rows.length} technicians</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Travel</p>
            <p className="text-2xl font-bold text-blue-600">{fmtMins(totals.travel)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Jobs Worked</p>
            <p className="text-2xl font-bold text-muted-foreground">{totals.jobs}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-tech table */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icon icon={FileText} size={16} className="text-muted-foreground/60" />
            Report: {from} — {to}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1.5 text-xs">
            <Icon icon={Download} size={14} /> Export CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 py-8 text-center">No data for this period</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map(({ tech, stats, byDate }) => (
                <ReportRow key={tech.technicianId} tech={tech} stats={stats} byDate={byDate} now={now} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportRow({ tech, stats, byDate, now }: { tech: TechTimesheetData; stats: ReturnType<typeof calcStats>; byDate: Record<string, TimesheetEntry[]>; now: Date }) {
  const [expanded, setExpanded] = useState(false);
  const dates = Object.keys(byDate).sort();
  return (
    <div>
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 text-left">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: tech.technicianColor }}>
          {tech.technicianName.slice(0, 1).toUpperCase()}
        </div>
        <span className="flex-1 text-sm font-medium text-foreground">{tech.technicianName}</span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
          <span className="text-orange-600 font-semibold">{fmtMins(stats.workMinutes)}</span>
          <span className="text-blue-600">{fmtMins(stats.travelMinutes)} travel</span>
          <span>{dates.length} day{dates.length !== 1 ? "s" : ""}</span>
        </div>
        {expanded ? <Icon icon={ChevronUp} size={16} className="text-muted-foreground/60 flex-shrink-0" /> : <Icon icon={ChevronDown} size={16} className="text-muted-foreground/60 flex-shrink-0" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 bg-muted/30 border-t border-border/60">
          {dates.map(date => {
            const entries = byDate[date];
            const ds = calcStats(entries, now);
            const clockIn = entries.find(e => e.entryType === "day_start");
            const clockOut = [...entries].reverse().find(e => e.entryType === "day_end");
            const jobIds = new Set(entries.filter(e => e.jobId).map(e => e.jobId));
            return (
              <div key={date} className="pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground">{date}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {clockIn && <span>In: {formatTime(clockIn.timestamp)}</span>}
                    {clockOut && <span>Out: {formatTime(clockOut.timestamp)}</span>}
                    <span className="text-orange-600 font-medium">{fmtMins(ds.workMinutes)}</span>
                    {ds.travelMinutes > 0 && <span className="text-blue-600">{fmtMins(ds.travelMinutes)} travel</span>}
                    {jobIds.size > 0 && <span>{jobIds.size} job{jobIds.size !== 1 ? "s" : ""}</span>}
                  </div>
                </div>
                <EntryGroups entries={[...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Weekly View ────────────────────────────────────────────────────────────────
interface WeekDayData {
  date: string;
  entries: TimesheetEntry[];
  workMinutes: number;
  travelMinutes: number;
  jobsCount: number;
}
interface WeekViewData {
  days: WeekDayData[];
  totalWorkMinutes: number;
  totalTravelMinutes: number;
  approvals: Record<string, { approvedBy: number; approvedAt: string; snapshotRate?: string | null }>;
}
interface TechSummary {
  technicianId: number;
  technicianName: string;
  technicianColor: string;
}

function fmtDayAbbr(dateStr: string) {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short" });
}
function fmtDateLabel(dateStr: string) {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function WeeklyView({ techs }: { techs: TechSummary[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedTechId, setSelectedTechId] = useState<number | null>(techs[0]?.technicianId ?? null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [techSearch, setTechSearch] = useState("");
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);

  const weekAnchor = useMemo(() => {
    if (weekOffset === 0) return undefined;
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d.toISOString().slice(0, 10);
  }, [weekOffset]);

  const today = todayStrCT();

  const { data: weekData, isLoading: weekLoading } = useQuery<WeekViewData>({
    queryKey: ["/api/admin/timesheets/week", selectedTechId, weekAnchor],
    queryFn: () => apiRequest("GET", `/api/admin/timesheets/week/${selectedTechId}${weekAnchor ? `?weekOf=${weekAnchor}` : ""}`).then(r => r.json()),
    enabled: selectedTechId !== null,
    staleTime: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ date, unapprove }: { date: string; unapprove?: boolean }) => {
      if (unapprove) {
        await apiRequest("DELETE", "/api/admin/timesheets/approve", { technicianId: selectedTechId, date });
      } else {
        await apiRequest("POST", "/api/admin/timesheets/approve", { technicianId: selectedTechId, date });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/timesheets/week", selectedTechId, weekAnchor] }),
    onError: (err: unknown) => toast({ title: "Approval failed", description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { entryType: string; timestamp: string; notes: string } }) =>
      apiRequest("PUT", `/api/admin/timesheets/entries/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/timesheets/week", selectedTechId, weekAnchor] });
      setEditingEntry(null);
    },
    onError: (err: unknown) => toast({ title: "Failed to save entry", description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/timesheets/entries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/timesheets/week", selectedTechId, weekAnchor] }),
    onError: (err: unknown) => toast({ title: "Failed to delete entry", description: getApiErrorMessage(err, "An unexpected error occurred."), variant: "destructive" }),
  });

  const filteredTechs = useMemo(() => {
    if (!techSearch.trim()) return techs;
    const q = techSearch.toLowerCase();
    return techs.filter(t => t.technicianName.toLowerCase().includes(q));
  }, [techs, techSearch]);

  const selectedTech = techs.find(t => t.technicianId === selectedTechId);
  const selectedDayData = weekData?.days.find(d => d.date === selectedDay);
  const isCurrentWeek = weekOffset === 0;

  return (
    <>
    <div className="flex gap-4 flex-col sm:flex-row">
      {/* Tech list sidebar */}
      <div className="w-full sm:w-56 flex-shrink-0 space-y-2">
        <div className="relative">
          <Icon icon={Search} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={techSearch}
            onChange={e => setTechSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-3 h-8 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 bg-card"
          />
        </div>
        <div className="space-y-1 max-h-[70vh] overflow-y-auto">
          {filteredTechs.map(t => (
            <button
              key={t.technicianId}
              onClick={() => { setSelectedTechId(t.technicianId); setSelectedDay(null); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition",
                selectedTechId === t.technicianId
                  ? "bg-orange-50 border border-orange-300 text-orange-800 font-medium"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted/30"
              )}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: t.technicianColor }}>
                {t.technicianName[0].toUpperCase()}
              </div>
              <span className="truncate">{t.technicianName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Week panel */}
      <div className="flex-1 min-w-0 space-y-4">
        {!selectedTech ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground/60">
            <Icon icon={User} size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select a technician</p>
          </div>
        ) : (
          <>
            {/* Week nav */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: selectedTech.technicianColor }}>
                    {selectedTech.technicianName[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{selectedTech.technicianName}</p>
                    {weekData && (
                      <p className="text-xs text-muted-foreground">
                        {fmtMins(weekData.totalWorkMinutes)} work · {fmtMins(weekData.totalTravelMinutes)} travel
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setWeekOffset(w => w - 1); setSelectedDay(null); }}
                    className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground/60">
                    <Icon icon={ChevronLeft} size={16} />
                  </button>
                  {!isCurrentWeek && (
                    <button onClick={() => { setWeekOffset(0); setSelectedDay(null); }}
                      className="text-xs font-medium text-orange-500 px-1">Today</button>
                  )}
                  <button onClick={() => { setWeekOffset(w => Math.min(0, w + 1)); setSelectedDay(null); }}
                    disabled={isCurrentWeek}
                    className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground/60 disabled:opacity-30">
                    <Icon icon={ChevronRight} size={16} />
                  </button>
                </div>
              </div>

              {weekLoading ? (
                <div className="grid grid-cols-7 gap-1">
                  {[...Array(7)].map((_, i) => <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />)}
                </div>
              ) : weekData ? (
                <>
                  <div className="grid grid-cols-7 gap-1">
                    {weekData.days.map(day => {
                      const isToday = day.date === today;
                      const hasDayEnd = day.entries.some(e => e.entryType === "day_end");
                      const hasData = day.entries.length > 0;
                      const isApproved = !!weekData.approvals[day.date];
                      const isSelected = selectedDay === day.date;
                      return (
                        <button
                          key={day.date}
                          onClick={() => setSelectedDay(isSelected ? null : day.date)}
                          title={isApproved
                            ? (weekData.approvals[day.date]?.snapshotRate != null
                                ? `Approved · Rate locked @ $${weekData.approvals[day.date].snapshotRate}/hr`
                                : "Approved · Rate not frozen (legacy — re-approve to lock)")
                            : undefined}
                          className={cn(
                            "rounded-lg p-2 text-center transition-all relative",
                            isSelected ? "ring-2 ring-orange-500 ring-offset-1" : "",
                            isApproved ? "bg-green-50 border border-green-300" :
                            isToday ? "bg-orange-100 border border-orange-300" :
                            hasDayEnd ? "bg-muted/30 border border-border hover:border-border" :
                            hasData ? "bg-muted/30 border border-border hover:border-border" :
                            "bg-muted/30 border border-border/60 opacity-40"
                          )}
                        >
                          {isApproved && (
                            <div className="absolute top-0.5 right-0.5">
                              <Icon icon={CheckCircle2} size={12} className="text-green-500" />
                            </div>
                          )}
                          <p className={cn("text-xs font-semibold",
                            isToday ? "text-orange-700" : isApproved ? "text-green-700" : "text-muted-foreground")}>
                            {fmtDayAbbr(day.date)}
                          </p>
                          {hasData ? (
                            <p className={cn("text-xs mt-1 font-medium leading-tight",
                              isApproved ? "text-green-700" : isToday ? "text-orange-800" : "text-muted-foreground")}>
                              {fmtMins(day.workMinutes)}
                            </p>
                          ) : (
                            <p className="text-xs mt-1 text-muted-foreground/50">—</p>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected day detail */}
                  {selectedDay && selectedDayData && (
                    <div className="mt-3 border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">{fmtDateLabel(selectedDay)}</p>
                          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                            {selectedDayData.workMinutes > 0 && <span className="text-orange-600 font-medium">Work: {fmtMins(selectedDayData.workMinutes)}</span>}
                            {selectedDayData.travelMinutes > 0 && <span className="text-blue-600 font-medium">Travel: {fmtMins(selectedDayData.travelMinutes)}</span>}
                            {selectedDayData.jobsCount > 0 && <span>{selectedDayData.jobsCount} job{selectedDayData.jobsCount !== 1 ? "s" : ""}</span>}
                          </div>
                        </div>
                        {selectedDayData.entries.length > 0 && (
                          weekData.approvals[selectedDay] ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <button
                                onClick={() => approveMutation.mutate({ date: selectedDay, unapprove: true })}
                                disabled={approveMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition border border-green-300"
                              >
                                <Icon icon={CheckCircle2} size={14} />
                                Approved — Undo
                              </button>
                              <span className="text-[10px] text-muted-foreground/70 pr-0.5">
                                {weekData.approvals[selectedDay]?.snapshotRate != null
                                  ? `Rate locked @ $${weekData.approvals[selectedDay].snapshotRate}/hr`
                                  : "Rate not frozen (legacy)"}
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => approveMutation.mutate({ date: selectedDay })}
                              disabled={approveMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 transition"
                            >
                              <Icon icon={CheckCircle2} size={14} />
                              Approve Day
                            </button>
                          )
                        )}
                      </div>
                      {selectedDayData.entries.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 p-4 text-center">No entries for this day</p>
                      ) : (
                        <div className="p-3">
                          <EntryGroups
                            entries={selectedDayData.entries}
                            onEdit={setEditingEntry}
                            onDelete={id => deleteMutation.mutate(id)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
    {editingEntry && (
      <EditEntryModal
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onSave={(id, data) => editMutation.mutate({ id, data })}
      />
    )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function AdminTimesheetPage() {
  const [mode, setMode] = useState<"daily" | "weekly" | "report">("daily");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mapVisible, setMapVisible] = useState(true);
  const [search, setSearch] = useState("");

  // Report range
  const today = todayStrCT();
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return dateStrCT(d);
  });
  const [reportTo, setReportTo] = useState(today);

  const now = new Date();
  const dateISO = formatDateISO(selectedDate);

  const { data, isLoading } = useQuery<TechTimesheetData[]>({
    queryKey: ["/api/admin/timesheets", dateISO],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/timesheets?date=${dateISO}`);
      return res.json();
    },
    refetchInterval: 30000,
    enabled: mode === "daily",
  });

  // Techs list for weekly view — derived from daily data (current or all) or fetched from technicians endpoint
  const { data: allTechsData } = useQuery<Array<{ technicianId: number; technicianName: string; technicianColor: string }>>({
    queryKey: ["/api/admin/timesheets/techs"],
    queryFn: async () => {
      // Reuse today's data to get tech list; fallback to fetching today
      const res = await apiRequest("GET", `/api/admin/timesheets?date=${todayStrCT()}`);
      const d: TechTimesheetData[] = await res.json();
      return d.map(t => ({ technicianId: t.technicianId, technicianName: t.technicianName, technicianColor: t.technicianColor }));
    },
    staleTime: 5 * 60_000,
    enabled: mode === "weekly",
  });

  const shiftDay = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const isToday = formatDateISO(selectedDate) === todayStrCT();

  // Filtered by search
  const filteredData = useMemo(() => {
    if (!data || !search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(t => t.technicianName.toLowerCase().includes(q));
  }, [data, search]);

  const totals = useMemo(() => {
    if (!filteredData) return { active: 0, totalWork: 0, totalTravel: 0, totalJobs: 0 };
    let active = 0, totalWork = 0, totalTravel = 0;
    const allJobs = new Set<number>();
    for (const tech of filteredData) {
      const s = calcStats(tech.entries, now);
      if (s.isDayStarted) active++;
      totalWork += s.workMinutes;
      totalTravel += s.travelMinutes;
      tech.entries.forEach(e => { if (e.jobId) allJobs.add(e.jobId); });
    }
    return { active, totalWork, totalTravel, totalJobs: allJobs.size };
  }, [filteredData]);

  const mapTracks = useMemo(() => {
    if (!filteredData) return [];
    return filteredData
      .map(tech => ({ technicianId: tech.technicianId, technicianName: tech.technicianName, technicianColor: tech.technicianColor, entries: tech.entries.filter(e => e.lat != null && e.lng != null) }))
      .filter(t => t.entries.length > 0);
  }, [filteredData]);

  const hasGpsData = mapTracks.length > 0;

  return (
    <Stack spacing={3}>
      {/* Mode tabs + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setMode("daily")}
              className={cn("px-3 py-1.5 text-sm font-medium transition", mode === "daily" ? "bg-orange-500 text-white" : "text-muted-foreground hover:bg-muted/30")}
            >
              Daily
            </button>
            <button
              onClick={() => setMode("weekly")}
              className={cn("px-3 py-1.5 text-sm font-medium transition", mode === "weekly" ? "bg-orange-500 text-white" : "text-muted-foreground hover:bg-muted/30")}
            >
              Weekly
            </button>
            <button
              onClick={() => setMode("report")}
              className={cn("px-3 py-1.5 text-sm font-medium transition", mode === "report" ? "bg-orange-500 text-white" : "text-muted-foreground hover:bg-muted/30")}
            >
              Report
            </button>
          </div>

          {mode === "daily" && (
            <>
              <Button variant="outline" size="icon" onClick={() => shiftDay(-1)}>
                <Icon icon={ChevronLeft} size={16} />
              </Button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg">
                <Icon icon={Calendar} size={16} className="text-muted-foreground/60" />
                <span className="text-sm font-medium text-muted-foreground">{formatDateLabel(selectedDate)}</span>
                {isToday && <Badge className="bg-orange-500 text-white text-xs ml-1">Today</Badge>}
              </div>
              <Button variant="outline" size="icon" onClick={() => shiftDay(1)} disabled={isToday}>
                <Icon icon={ChevronRight} size={16} />
              </Button>
              {!isToday && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())} className="text-orange-500">Today</Button>
              )}
            </>
          )}

          {mode === "report" && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Icon icon={Calendar} size={14} className="text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground/60">From</span>
                <input type="date" value={reportFrom} max={reportTo} onChange={e => setReportFrom(e.target.value)}
                  className="border border-border rounded-lg px-2 py-1 text-sm text-muted-foreground bg-card focus:outline-none focus:ring-1 focus:ring-orange-400" />
                <span className="text-xs text-muted-foreground/60">To</span>
                <input type="date" value={reportTo} min={reportFrom} max={today} onChange={e => setReportTo(e.target.value)}
                  className="border border-border rounded-lg px-2 py-1 text-sm text-muted-foreground bg-card focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === "daily" && (
            <>
              <div className="relative">
                <Icon icon={Search} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search technician..."
                  className="pl-8 h-8 text-sm w-44"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setMapVisible(v => !v)}
                className={cn(mapVisible ? "border-orange-300 text-orange-600 bg-orange-50" : "")}>
                <Icon icon={MapPin} size={14} className="mr-1.5" />
                {mapVisible ? "Hide Map" : "Show Map"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Report mode */}
      {mode === "report" && <ReportView from={reportFrom} to={reportTo} />}

      {/* Weekly mode */}
      {mode === "weekly" && (
        allTechsData && allTechsData.length > 0
          ? <WeeklyView techs={allTechsData} />
          : <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      )}

      {/* Daily mode */}
      {mode === "daily" && (
        <>
          {!isLoading && filteredData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active Today</p><p className="text-2xl font-bold text-green-600">{totals.active}</p><p className="text-xs text-muted-foreground/60">of {filteredData.length} techs</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Work</p><p className="text-2xl font-bold text-orange-600">{fmtMins(totals.totalWork)}</p><p className="text-xs text-muted-foreground/60">all technicians</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Travel</p><p className="text-2xl font-bold text-blue-600">{fmtMins(totals.totalTravel)}</p><p className="text-xs text-muted-foreground/60">drive time</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Jobs Worked</p><p className="text-2xl font-bold text-muted-foreground">{totals.totalJobs}</p><p className="text-xs text-muted-foreground/60">unique jobs</p></CardContent></Card>
            </div>
          )}

          {mapVisible && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"><Icon icon={MapPin} size={16} className="text-orange-500" />Technician Locations</CardTitle>
                  {!isLoading && !hasGpsData && <span className="text-xs text-muted-foreground/60">No GPS data for this day</span>}
                  {hasGpsData && <span className="text-xs text-muted-foreground/60">{mapTracks.length} tech{mapTracks.length !== 1 ? "s" : ""} tracked</span>}
                </div>
                {hasGpsData && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {mapTracks.map(t => (
                      <div key={t.technicianId} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.technicianColor }} />
                        <span className="text-xs text-muted-foreground">{t.technicianName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? <Skeleton className="h-80 w-full rounded-none" /> : <TechnicianMap tracks={mapTracks} className="h-80 w-full" />}
              </CardContent>
              {hasGpsData && (
                <div className="px-4 pb-3 pt-2 flex flex-wrap gap-3 text-xs text-muted-foreground border-t border-border/60">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />Day Start</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-muted-foreground/40 flex-shrink-0" />Day End</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />Travel Start</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-cyan-500 flex-shrink-0" />Arrived</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 flex-shrink-0" />Work Start</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />Work End</span>
                  <span className="flex items-center gap-1 ml-auto text-muted-foreground/60">Dashed line = travel route</span>
                </div>
              )}
            </Card>
          )}

          <div className="space-y-3">
            {isLoading ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)
            ) : filteredData && filteredData.length > 0 ? (
              filteredData.map(tech => <TechCard key={tech.technicianId} tech={tech} now={now} />)
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center text-muted-foreground/60 text-sm">
                  {search ? "No technicians match your search" : "No technicians found"}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </Stack>
  );
}
