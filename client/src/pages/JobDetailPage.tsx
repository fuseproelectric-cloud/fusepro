import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { jobsApi, jobMaterialsApi, timesheetApi, customersApi, techniciansApi } from "@/lib/api";
import { markJobRead } from "@/hooks/useUnreadMessages";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCurrentLocation } from "@/lib/gps";
import { useAuth } from "@/hooks/useAuth";
import { fmtTime, fmtScheduledAt, fmtCompletedAt, fmtNoteTime } from "@/lib/time";
import {
  ArrowLeft, MapPin, Phone, Mail, Clock, User,
  Loader2, Send, Truck, CheckCircle2, Plus, Trash2, X, Wrench, ExternalLink,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AddressAutocompleteInput } from "@/components/AddressAutocompleteInput";
import { cn, statusChipSx, priorityChipSx, formatStatus } from "@/lib/utils";
import { getSocket } from "@/lib/socket";
import { apiRequest } from "@/lib/queryClient";
import { TechnicianMap } from "@/components/TechnicianMap";
import Stack from "@mui/material/Stack";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Chip from "@mui/material/Chip";

type JobNote = { id: number; content: string; createdAt: string; user?: { id: number; name: string } | null };

type Job = {
  id: number; title: string; status: string; priority: string;
  description: string | null; scheduledAt: string | null; completedAt: string | null;
  address: string | null; duration: number | null; customerId: number | null;
  technicianId: number | null; notes: string | null; requestId: number | null;
  customerName?: string | null; notes_list?: JobNote[];
};

type Customer = { id: number; name: string; phone: string | null; email: string | null; address: string | null };

type TimesheetEntry = {
  id: number; technicianId: number; jobId: number | null; entryType: string;
  timestamp: string; notes: string | null;
  lat?: number | null; lng?: number | null; address?: string | null;
  jobTitle?: string | null;
};

type JobMaterial = {
  id: number; jobId: number; name: string;
  quantity: string | null; unit: string | null; unitCost: string | null; notes: string | null;
};


function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ElapsedTimer({ fromTs, prefix = "" }: { fromTs: string; prefix?: string }) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const start = new Date(fromTs).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    ref.current = setInterval(tick, 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [fromTs]);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return <span>{prefix}{h}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>;
}

const ENTRY_ICONS: Record<string, string> = {
  travel_start: "🚗", travel_end: "📍", work_start: "🔧", work_end: "✅",
};
const ENTRY_LABELS: Record<string, string> = {
  travel_start: "On the Way", travel_end: "Arrived", work_start: "Work Started", work_end: "Work Completed",
};

function CompletionModal({ open, job, timesheetEntries, onClose, onComplete }: {
  open: boolean; job: Job; timesheetEntries: TimesheetEntry[];
  onClose: () => void; onComplete: (workSummary: string) => void;
}) {
  const [workSummary, setWorkSummary] = useState("");
  const [matName, setMatName] = useState("");
  const [matQty, setMatQty] = useState("1");
  const [matUnit, setMatUnit] = useState("pcs");
  const [matCost, setMatCost] = useState("0");
  const qc = useQueryClient();

  const { data: materials = [] } = useQuery<JobMaterial[]>({
    queryKey: [`/api/jobs/${job.id}/materials`],
    queryFn: () => jobMaterialsApi.getAll(job.id),
  });

  const addMatMutation = useMutation({
    mutationFn: () => jobMaterialsApi.create(job.id, { name: matName, quantity: matQty, unit: matUnit, unitCost: matCost }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/materials`] });
      setMatName(""); setMatQty("1"); setMatUnit("pcs"); setMatCost("0");
    },
  });

  const deleteMatMutation = useMutation({
    mutationFn: (id: number) => jobMaterialsApi.delete(job.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}/materials`] }),
  });

  const jobEntries = timesheetEntries.filter((e) => e.jobId === job.id);
  const sorted = [...jobEntries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let travelMinutes = 0, workMinutes = 0;
  let openTravel: Date | null = null, openWork: Date | null = null;
  const now = new Date();
  for (const e of sorted) {
    if (e.entryType === "travel_start") openTravel = new Date(e.timestamp);
    else if (e.entryType === "travel_end" && openTravel) { travelMinutes += Math.floor((new Date(e.timestamp).getTime() - openTravel.getTime()) / 60000); openTravel = null; }
    if (e.entryType === "work_start") openWork = new Date(e.timestamp);
    else if (e.entryType === "work_end" && openWork) { workMinutes += Math.floor((new Date(e.timestamp).getTime() - openWork.getTime()) / 60000); openWork = null; }
  }
  if (openTravel) travelMinutes += Math.floor((now.getTime() - openTravel.getTime()) / 60000);
  if (openWork) workMinutes += Math.floor((now.getTime() - openWork.getTime()) / 60000);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1.0625rem", pb: 1 }}>Complete Job</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">Work Summary *</label>
          <Textarea placeholder="Describe what was done..." value={workSummary} onChange={(e) => setWorkSummary(e.target.value)} className="resize-none" rows={4} />
        </div>
        <div className="bg-muted/30 rounded-lg p-3 space-y-1">
          <p className="text-sm font-medium text-muted-foreground mb-2">Time Summary</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Travel</span>
            <span className="font-medium text-foreground">{formatDuration(travelMinutes)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Work</span>
            <span className="font-medium text-foreground">{formatDuration(workMinutes)}</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Materials Used</p>
          {materials.length > 0 && (
            <div className="space-y-2 mb-3">
              {materials.map((mat) => (
                <div key={mat.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{mat.name}</p>
                    <p className="text-xs text-muted-foreground">{mat.quantity} {mat.unit} @ ${mat.unitCost} each</p>
                  </div>
                  <button onClick={() => deleteMatMutation.mutate(mat.id)} className="text-muted-foreground/60 hover:text-red-500 flex-shrink-0">
                    <Icon icon={Trash2} size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Material</p>
            <Input placeholder="Material name" value={matName} onChange={(e) => setMatName(e.target.value)} className="h-9 text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Qty" value={matQty} onChange={(e) => setMatQty(e.target.value)} className="h-9 text-sm" />
              <Input placeholder="Unit" value={matUnit} onChange={(e) => setMatUnit(e.target.value)} className="h-9 text-sm" />
              <Input placeholder="Cost $" value={matCost} onChange={(e) => setMatCost(e.target.value)} className="h-9 text-sm" />
            </div>
            <Button variant="outline" size="sm" className="w-full h-9" onClick={() => matName.trim() && addMatMutation.mutate()} disabled={!matName.trim() || addMatMutation.isPending}>
              {addMatMutation.isPending ? <Icon icon={Loader2} size={16} className="animate-spin mr-1" /> : <Icon icon={Plus} size={16} className="mr-1" />} Add
            </Button>
          </div>
        </div>
        <Button className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base font-bold" onClick={() => workSummary.trim() && onComplete(workSummary)} disabled={!workSummary.trim()}>
          <Icon icon={CheckCircle2} size={20} className="mr-2" /> Mark as Completed
        </Button>
      </DialogContent>
    </Dialog>
  );
}

const GPS_TS_TYPES = new Set(["travel_start", "travel_end", "work_start"]);

function JobTimesheetControl({
  jobId,
  entries,
  isDayStarted,
  onClockIn,
  clockInLoading,
}: {
  jobId: number;
  entries: TimesheetEntry[];
  isDayStarted: boolean;
  onClockIn: () => void;
  clockInLoading: boolean;
}) {
  const qc = useQueryClient();
  const [gpsJobId, setGpsJobId] = useState<string | null>(null);

  const jobEntries = entries
    .filter(e => e.jobId === jobId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Determine next action
  const has = (type: string) => jobEntries.some(e => e.entryType === type);
  const lastOf = (type: string) => jobEntries.filter(e => e.entryType === type).pop();
  const workStart = lastOf("work_start");
  const workEnd = lastOf("work_end");
  const isWorking = workStart && (!workEnd || new Date(workStart.timestamp) > new Date(workEnd.timestamp));

  let nextAction: "travel_start" | "travel_end" | "work_start" | "work_end" | "done";
  if (isWorking) nextAction = "work_end";
  else if (has("work_start")) nextAction = "done";
  else if (has("travel_end")) nextAction = "work_start";
  else if (has("travel_start")) nextAction = "travel_end";
  else nextAction = "travel_start";

  // Time calculations
  let workMins = 0, travelMins = 0;
  let openWork: Date | null = null, openTravel: Date | null = null;
  const now = new Date();
  for (const e of jobEntries) {
    if (e.entryType === "travel_start") openTravel = new Date(e.timestamp);
    else if (e.entryType === "travel_end" && openTravel) {
      travelMins += Math.floor((new Date(e.timestamp).getTime() - openTravel.getTime()) / 60000);
      openTravel = null;
    }
    if (e.entryType === "work_start") openWork = new Date(e.timestamp);
    else if (e.entryType === "work_end" && openWork) {
      workMins += Math.floor((new Date(e.timestamp).getTime() - openWork.getTime()) / 60000);
      openWork = null;
    }
  }
  if (openTravel) travelMins += Math.floor((now.getTime() - openTravel.getTime()) / 60000);
  if (openWork) workMins += Math.floor((now.getTime() - openWork.getTime()) / 60000);

  const tsMutation = useMutation({
    mutationFn: (data: Parameters<typeof timesheetApi.createEntry>[0]) => timesheetApi.createEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/timesheet/today"] });
      setGpsJobId(null);
    },
    onError: () => setGpsJobId(null),
  });

  const handleAction = async (entryType: string) => {
    setGpsJobId(entryType);
    let gps: { lat?: number; lng?: number; address?: string } = {};
    if (GPS_TS_TYPES.has(entryType)) {
      const loc = await getCurrentLocation();
      if (loc) gps = { lat: loc.lat, lng: loc.lng, address: loc.address };
    }
    tsMutation.mutate({ entryType, jobId, ...gps });
  };

  const isLoading = tsMutation.isPending || gpsJobId !== null;

  if (!isDayStarted) {
    return (
      <div className="bg-card rounded-lg border border-border p-4 space-y-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Icon icon={Clock} size={16} className="text-blue-500" /> Timesheet
        </h2>
        <p className="text-sm text-muted-foreground">You haven't clocked in yet today.</p>
        <Button
          className="w-full h-11 bg-blue-500 hover:bg-blue-700 text-white font-semibold"
          onClick={onClockIn}
          disabled={clockInLoading}
        >
          {clockInLoading
            ? <><Icon icon={Loader2} size={16} className="animate-spin mr-2" />Getting location...</>
            : <><Icon icon={Clock} size={16} className="mr-2" />Clock In for the Day</>
          }
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-4 space-y-3">
      <h2 className="font-semibold text-foreground flex items-center gap-2">
        <Icon icon={Clock} size={16} className="text-blue-500" /> Timesheet
      </h2>

      {/* Time totals */}
      {(travelMins > 0 || workMins > 0) && (
        <div className="flex gap-3">
          {travelMins > 0 && (
            <div className="flex-1 bg-blue-50 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-blue-500 font-medium">Travel</p>
              <p className="text-base font-bold text-blue-700">{formatDuration(travelMins)}</p>
            </div>
          )}
          {workMins > 0 && (
            <div className="flex-1 bg-blue-50 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-blue-500 font-medium">Work</p>
              <p className="text-base font-bold text-blue-800">{formatDuration(workMins)}</p>
            </div>
          )}
        </div>
      )}

      {/* Progress steps */}
      <div className="flex items-center gap-1 text-xs flex-wrap">
        {(["travel_start", "travel_end", "work_start", "work_end"] as const).map((step, i) => {
          const done = jobEntries.some(e => e.entryType === step);
          const labels: Record<string, string> = {
            travel_start: "On the Way", travel_end: "Arrived",
            work_start: "Work Start", work_end: "Work End",
          };
          return (
            <div key={step} className="flex items-center gap-1">
              {i > 0 && <div className={`w-4 h-px ${done ? "bg-green-400" : "bg-muted"}`} />}
              <span className={`px-1.5 py-0.5 rounded font-medium ${done ? "bg-green-100 text-green-700" : "bg-muted/50 text-muted-foreground/60"}`}>
                {labels[step]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Action button */}
      {nextAction !== "done" && (
        <Button
          className={
            nextAction === "travel_start" ? "w-full h-11 bg-blue-500 hover:bg-blue-600 text-white font-semibold" :
            nextAction === "travel_end"   ? "w-full h-11 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold" :
            nextAction === "work_start"   ? "w-full h-11 bg-blue-500 hover:bg-blue-700 text-white font-semibold" :
                                            "w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold"
          }
          onClick={() => handleAction(nextAction)}
          disabled={isLoading}
        >
          {isLoading
            ? <><Icon icon={Loader2} size={16} className="animate-spin mr-2" />Getting location...</>
            : nextAction === "travel_start" ? <><Icon icon={Truck} size={16} className="mr-2" />On the Way</>
            : nextAction === "travel_end"   ? <><Icon icon={MapPin} size={16} className="mr-2" />I Arrived</>
            : nextAction === "work_start"   ? <><Icon icon={Wrench} size={16} className="mr-2" />Start Work</>
            :                                 <><Icon icon={CheckCircle2} size={16} className="mr-2" />End Work</>
          }
        </Button>
      )}

      {nextAction === "done" && (
        <p className="text-sm text-green-600 font-medium text-center py-1">
          Work completed · {formatDuration(workMins)} logged
        </p>
      )}
    </div>
  );
}

// ── Edit Job Modal ─────────────────────────────────────────────────────────
function EditJobModal({ open, job, onClose, onSaved }: {
  open: boolean; job: Job; onClose: () => void; onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(job.title);
  const [status, setStatus] = useState(job.status);
  const [priority, setPriority] = useState(job.priority ?? "normal");
  const [customerId, setCustomerId] = useState<number | null>(job.customerId ?? null);
  const [technicianId, setTechnicianId] = useState(job.technicianId ? String(job.technicianId) : "none");
  const [dateStr, setDateStr] = useState(job.scheduledAt ? format(new Date(job.scheduledAt), "yyyy-MM-dd") : "");
  const [timeStr, setTimeStr] = useState(job.scheduledAt ? format(new Date(job.scheduledAt), "HH:mm") : "09:00");
  const [address, setAddress] = useState(job.address ?? "");
  const [error, setError] = useState<string | null>(null);

  const { data: allCustomers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: customersApi.getAll,
  });
  const { data: allTechnicians = [] } = useQuery<{ id: number; user?: { name: string } }[]>({
    queryKey: ["/api/technicians"],
    queryFn: techniciansApi.getAll,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      setError(null);
      const scheduledAt = dateStr ? new Date(`${dateStr}T${timeStr}:00`).toISOString() : null;
      return jobsApi.update(job.id, {
        title: title.trim(),
        status,
        priority,
        customerId: customerId,
        technicianId: technicianId !== "none" ? Number(technicianId) : null,
        scheduledAt,
        address: address.trim() || null,
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onSaved();
      onClose();
    },
    onError: (err: any) => setError(err.message ?? "Failed to save"),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, fontSize: "1rem", pb: 1 }}>Edit Job</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="h-9" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
              <Input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Time</label>
              <Input type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Customer</label>
            <CustomerCombobox
              customers={allCustomers as any}
              value={customerId}
              onChange={setCustomerId}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Technician</label>
            <Select value={technicianId} onValueChange={setTechnicianId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {allTechnicians.map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.user?.name ?? `Tech #${t.id}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Address</label>
            <AddressAutocompleteInput
              value={address}
              onChange={e => setAddress(e.target.value)}
              onPlaceSelect={(r) => setAddress([r.address, r.city, r.state, r.zip].filter(Boolean).join(", "))}
              placeholder="Job address..."
              className="h-9 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-10" onClick={onClose} disabled={saveMutation.isPending}>Cancel</Button>
            <Button
              className="flex-1 h-10 bg-blue-500 hover:bg-blue-700 text-white font-semibold"
              onClick={() => saveMutation.mutate()}
              disabled={!title.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? <><Icon icon={Loader2} size={16} className="animate-spin mr-2" />Saving...</> : "Save"}
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
}

export function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isTechnician = user?.role === "technician";

  const [noteContent, setNoteContent] = useState("");
  const [liveNotes, setLiveNotes] = useState<JobNote[]>([]);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [clockInLoading, setClockInLoading] = useState(false);
  const notesEndRef = useRef<HTMLDivElement>(null);

  const { data: job, isLoading } = useQuery<Job & { notes: JobNote[] }>({
    queryKey: [`/api/jobs/${jobId}`],
    queryFn: () => jobsApi.getById(jobId),
    enabled: !!jobId,
    refetchInterval: 15000,
  });

  const { data: customer } = useQuery<Customer>({
    queryKey: [`/api/customers/${job?.customerId}`],
    queryFn: () => apiRequest("GET", `/api/customers/${job!.customerId}`).then((r) => r.json()),
    enabled: !!job?.customerId,
  });

  const { data: timesheetData } = useQuery<{ entries: TimesheetEntry[]; status: any }>({
    queryKey: ["/api/timesheet/today"],
    queryFn: () => apiRequest("GET", "/api/timesheet/today").then((r) => r.json()),
    enabled: isTechnician,
    refetchInterval: 30000,
  });

  const { data: jobTimesheetHistory = [] } = useQuery<(TimesheetEntry & { technicianName?: string | null })[]>({
    queryKey: [`/api/jobs/${jobId}/timesheet`],
    queryFn: () => apiRequest("GET", `/api/jobs/${jobId}/timesheet`).then(r => r.json()),
    enabled: !!jobId,
    refetchInterval: 30000,
  });

  const { data: materials = [] } = useQuery<JobMaterial[]>({
    queryKey: [`/api/jobs/${jobId}/materials`],
    queryFn: () => jobMaterialsApi.getAll(jobId),
    enabled: !!jobId && (job?.status === "in_progress" || job?.status === "completed"),
  });

  const allNotes = [...(job?.notes ?? []), ...liveNotes].reduce<JobNote[]>((acc, note) => {
    if (!acc.find((n) => n.id === note.id)) acc.push(note);
    return acc;
  }, []).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  useEffect(() => {
    if (!jobId) return;
    markJobRead(jobId); // Clear unread badge when opening the job
    const socket = getSocket();
    socket.emit("join:job", jobId);
    const noteHandler = (note: JobNote) => {
      markJobRead(jobId); // Also clear as messages arrive while viewing
      setLiveNotes((prev) => prev.find((n) => n.id === note.id) ? prev : [...prev, note]);
    };
    socket.on("job:note", noteHandler);
    return () => { socket.off("job:note", noteHandler); };
  }, [jobId]);

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allNotes.length]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ status, notes, lat, lng, address }: { status: string; notes?: string; lat?: number; lng?: number; address?: string }) =>
      apiRequest("PUT", `/api/jobs/${jobId}/status`, { status, notes, lat, lng, address }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/jobs/my"] });
      qc.invalidateQueries({ queryKey: ["/api/timesheet/today"] });
      qc.invalidateQueries({ queryKey: ["/api/timesheet/week"] });
      qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setShowCompletionModal(false);
      setGpsLoading(false);
    },
    onError: () => setGpsLoading(false),
  });

  // Wrapper: capture GPS then update status
  const handleStatusUpdate = async (status: string, notes?: string) => {
    const gpsStatuses = new Set(["on_the_way", "in_progress", "completed"]);
    let gps: { lat?: number; lng?: number; address?: string } = {};
    if (gpsStatuses.has(status)) {
      setGpsLoading(true);
      const loc = await getCurrentLocation();
      if (loc) gps = { lat: loc.lat, lng: loc.lng, address: loc.address };
    }
    updateStatusMutation.mutate({ status, notes, ...gps });
  };

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => jobsApi.addNote(jobId, content),
    onSuccess: () => {
      setNoteContent("");
      qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
    },
  });

  // Timesheet entries for this job
  const jobTimesheetEntries = (timesheetData?.entries ?? [])
    .filter((e) => e.jobId === jobId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const travelStartEntry = [...jobTimesheetEntries].reverse().find((e) => e.entryType === "travel_start");
  const workStartEntry = [...jobTimesheetEntries].reverse().find((e) => e.entryType === "work_start");

  // GPS entries for mini map
  const gpsEntries = jobTimesheetEntries.filter((e) => e.lat != null && e.lng != null);

  const clockInMutation = useMutation({
    mutationFn: (data: Parameters<typeof timesheetApi.createEntry>[0]) => timesheetApi.createEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/timesheet/today"] });
      setClockInLoading(false);
    },
    onError: () => setClockInLoading(false),
  });

  const handleClockIn = async () => {
    setClockInLoading(true);
    const loc = await getCurrentLocation();
    const gps = loc ? { lat: loc.lat, lng: loc.lng, address: loc.address } : {};
    clockInMutation.mutate({ entryType: "day_start", ...gps });
  };

  const isBusy = updateStatusMutation.isPending || gpsLoading;

  if (isLoading) {
    return <div className="flex justify-center py-20"><Icon icon={Loader2} size={24} className="animate-spin text-blue-500" /></div>;
  }

  if (!job) {
    return (
      <div className="text-center py-20 text-muted-foreground/60">
        <p>Job not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate(-1 as any)}>Go back</Button>
      </div>
    );
  }

  const backHref = isTechnician ? "/my-jobs" : "/jobs";

  return (
    <Stack spacing={3} sx={{ maxWidth: 896, mx: "auto", pb: 4 }}>
      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-muted-foreground -ml-2" onClick={() => navigate(backHref)}>
        <Icon icon={ArrowLeft} size={16} className="mr-1" /> Back
      </Button>

      {/* Live Work Timer */}
      {isTechnician && job.status === "in_progress" && workStartEntry && (
        <div className="bg-blue-500 rounded-lg p-5 text-white text-center">
          <p className="text-blue-100 text-sm font-medium mb-1">Working...</p>
          <p className="text-4xl font-mono font-bold tracking-wider">
            <ElapsedTimer fromTs={workStartEntry.timestamp} />
          </p>
          {workStartEntry.address && (
            <p className="text-blue-200 text-xs mt-2 flex items-center justify-center gap-1">
              <Icon icon={MapPin} size={12} /> Started at: {workStartEntry.address}
            </p>
          )}
        </div>
      )}

      {/* Travel Timer */}
      {isTechnician && job.status === "on_the_way" && travelStartEntry && (
        <div className="bg-blue-500 rounded-lg p-4 text-white">
          <div className="flex items-center gap-3">
            <Icon icon={Truck} size={24} className="flex-shrink-0" />
            <div className="flex-1">
              <p className="text-blue-100 text-xs">En Route</p>
              <p className="text-xl font-mono font-bold"><ElapsedTimer fromTs={travelStartEntry.timestamp} /></p>
              {travelStartEntry.address && (
                <p className="text-blue-200 text-xs mt-0.5 flex items-center gap-1">
                  <Icon icon={MapPin} size={12} className="flex-shrink-0" /> Departed from: {travelStartEntry.address}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Chip size="small" label={formatStatus(job.status)} sx={statusChipSx(job.status)} />
            {job.priority && (
              <Chip size="small" label={`${formatStatus(job.priority)} priority`} sx={priorityChipSx(job.priority)} />
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col items-end gap-2">
          {isTechnician ? (
            <>
              {!timesheetData?.status?.isDayStarted && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                  Clock in first to start working on this job
                </p>
              )}
              <div className="flex gap-2 flex-wrap justify-end">
                {job.status === "assigned" && (
                  <Button
                    className="bg-blue-500 hover:bg-blue-700 text-white h-11 font-semibold disabled:opacity-40"
                    onClick={() => handleStatusUpdate("on_the_way")}
                    disabled={isBusy || !timesheetData?.status?.isDayStarted}
                  >
                    {gpsLoading ? <><Icon icon={Loader2} size={16} className="animate-spin mr-2" />Getting location...</> : <><Icon icon={Truck} size={16} className="mr-2" />On the Way</>}
                  </Button>
                )}
                {job.status === "on_the_way" && (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white h-11 font-semibold disabled:opacity-40"
                    onClick={() => handleStatusUpdate("in_progress")}
                    disabled={isBusy || !timesheetData?.status?.isDayStarted}
                  >
                    {gpsLoading ? <><Icon icon={Loader2} size={16} className="animate-spin mr-2" />Getting location...</> : <><Icon icon={CheckCircle2} size={16} className="mr-2" />Arrived – Start Job</>}
                  </Button>
                )}
                {job.status === "in_progress" && (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white h-11 font-semibold disabled:opacity-40"
                    onClick={() => setShowCompletionModal(true)}
                    disabled={isBusy || !timesheetData?.status?.isDayStarted}
                  >
                    <Icon icon={CheckCircle2} size={16} className="mr-2" /> Complete Job
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Button variant="outline" className="h-10" onClick={() => setShowEditModal(true)}>Edit Job</Button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Job info */}
          <div className="bg-card rounded-lg border border-border p-4 space-y-3">
            <h2 className="font-semibold text-foreground">Job Details</h2>
            {job.description && <p className="text-sm text-muted-foreground">{job.description}</p>}
            {job.requestId && (
              <button
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline text-left"
                onClick={() => navigate(`/requests?id=${job.requestId}`)}
              >
                From Request #{job.requestId}
              </button>
            )}
            <div className="space-y-2">
              {job.scheduledAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Icon icon={Clock} size={16} className="text-muted-foreground/60 flex-shrink-0" />
                  <span className="text-muted-foreground">{fmtScheduledAt(job.scheduledAt)}</span>
                </div>
              )}
              {job.address && (
                <div className="flex items-start gap-2 text-sm">
                  <Icon icon={MapPin} size={16} className="text-muted-foreground/60 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground flex-1">{job.address}</span>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground/40 hover:text-blue-600 flex-shrink-0"
                    title="Open in Google Maps"
                  >
                    <Icon icon={ExternalLink} size={14} />
                  </a>
                </div>
              )}
              {job.completedAt && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-600 font-medium">Completed {fmtCompletedAt(job.completedAt!)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timesheet control for technicians */}
          {isTechnician && job.status !== "completed" && job.status !== "cancelled" && (
            <JobTimesheetControl
              jobId={jobId}
              entries={timesheetData?.entries ?? []}
              isDayStarted={timesheetData?.status?.isDayStarted ?? false}
              onClockIn={handleClockIn}
              clockInLoading={clockInLoading}
            />
          )}

          {/* Customer */}
          {customer && (
            <div className="bg-card rounded-lg border border-border p-4 space-y-3">
              <h2 className="font-semibold text-foreground">Customer</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Icon icon={User} size={16} className="text-muted-foreground/60 flex-shrink-0" />
                  <span className="font-medium text-foreground">{customer.name}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Icon icon={Phone} size={16} className="text-muted-foreground/60 flex-shrink-0" />
                    <a href={`tel:${customer.phone}`} className="text-blue-600 hover:text-blue-700">{customer.phone}</a>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Icon icon={Mail} size={16} className="text-muted-foreground/60 flex-shrink-0" />
                    <a href={`mailto:${customer.email}`} className="text-blue-600 hover:text-blue-700">{customer.email}</a>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <Icon icon={MapPin} size={16} className="text-muted-foreground/60 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{customer.address}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Materials */}
          {(job.status === "in_progress" || job.status === "completed") && (
            <div className="bg-card rounded-lg border border-border p-4 space-y-3">
              <h2 className="font-semibold text-foreground">Materials Used</h2>
              {materials.length === 0 ? (
                <p className="text-sm text-muted-foreground/60">No materials recorded</p>
              ) : (
                <div className="space-y-2">
                  {materials.map((mat) => (
                    <div key={mat.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{mat.name}</span>
                      <span className="text-muted-foreground">{mat.quantity} {mat.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Job Timeline */}
          {(() => {
            const timelineEntries = isTechnician ? jobTimesheetEntries : jobTimesheetHistory;
            if (timelineEntries.length === 0) return null;
            const mapEntries = timelineEntries.filter((e) => e.lat != null && e.lng != null);
            return (
              <div className="bg-card rounded-lg border border-border p-4 space-y-3">
                <h2 className="font-semibold text-foreground">Job Timeline</h2>
                <div className="space-y-2">
                  {timelineEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 text-sm">
                      <span className="text-base flex-shrink-0 mt-0.5">
                        {ENTRY_ICONS[entry.entryType] ?? "•"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-muted-foreground font-medium">
                          {ENTRY_LABELS[entry.entryType] ?? entry.entryType.replace(/_/g, " ")}
                        </span>
                        {!isTechnician && (entry as any).technicianName && (
                          <span className="text-xs text-muted-foreground/60 ml-1.5">· {(entry as any).technicianName}</span>
                        )}
                        {entry.address && (
                          <p className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                            <Icon icon={MapPin} size={12} className="flex-shrink-0" />
                            {entry.address}
                          </p>
                        )}
                        {entry.notes && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">{entry.notes}</p>
                        )}
                      </div>
                      <span className="text-muted-foreground/60 flex-shrink-0 text-xs font-mono mt-0.5">
                        {fmtTime(entry.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>

                {mapEntries.length > 0 && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-border" style={{ isolation: "isolate" }}>
                    <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/30 border-b border-border/60 flex items-center gap-1">
                      <Icon icon={MapPin} size={12} className="text-blue-500" />
                      Route Map
                    </p>
                    <TechnicianMap
                      tracks={[{
                        technicianId: job.technicianId ?? 0,
                        technicianName: isTechnician ? (user?.name ?? "Me") : ((jobTimesheetHistory[0] as any)?.technicianName ?? "Technician"),
                        technicianColor: "#2563eb",
                        entries: mapEntries,
                      }]}
                      className="h-48"
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Right column — Chat */}
        <div className="space-y-4">
          <div className="bg-card rounded-lg border border-border flex flex-col" style={{ height: 480 }}>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between flex-shrink-0">
              <h2 className="font-semibold text-foreground text-sm">Chat</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-muted-foreground/60">Live</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {allNotes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <p className="text-2xl mb-2">💬</p>
                  <p className="text-sm text-muted-foreground/60">No messages yet</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">Start a conversation</p>
                </div>
              ) : (
                allNotes.map((note) => {
                  const isOwn = note.user?.id === user?.id;
                  const initials = (note.user?.name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={note.id} className={cn("flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
                      {/* Avatar */}
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5",
                        isOwn ? "bg-blue-500" : "bg-muted-foreground/40"
                      )}>
                        {initials}
                      </div>
                      {/* Bubble */}
                      <div className={cn("max-w-[75%] space-y-0.5", isOwn ? "items-end" : "items-start", "flex flex-col")}>
                        <div className={cn(
                          "px-3 py-2 rounded-xl text-sm leading-relaxed",
                          isOwn
                            ? "bg-blue-500 text-white rounded-tr-sm"
                            : "bg-muted/50 text-foreground rounded-tl-sm"
                        )}>
                          {note.content}
                        </div>
                        <div className={cn("flex items-center gap-1.5 px-1", isOwn ? "flex-row-reverse" : "flex-row")}>
                          <span className="text-[10px] text-muted-foreground/60 font-medium">{note.user?.name ?? "Unknown"}</span>
                          <span className="text-[10px] text-muted-foreground/50">·</span>
                          <span className="text-[10px] text-muted-foreground/60">{fmtNoteTime(note.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={notesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-2 border-t border-border/60 flex-shrink-0">
              <div className="flex gap-2 items-end">
                <Textarea
                  placeholder="Type a message..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (noteContent.trim()) addNoteMutation.mutate(noteContent.trim());
                    }
                  }}
                  className="resize-none text-sm flex-1 min-h-[40px] max-h-[100px]"
                  rows={1}
                />
                <Button
                  size="icon"
                  className="bg-blue-500 hover:bg-blue-700 text-white h-10 w-10 flex-shrink-0"
                  onClick={() => noteContent.trim() && addNoteMutation.mutate(noteContent.trim())}
                  disabled={!noteContent.trim() || addNoteMutation.isPending}
                >
                  {addNoteMutation.isPending
                    ? <Icon icon={Loader2} size={16} className="animate-spin" />
                    : <Icon icon={Send} size={16} />
                  }
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-right">Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Modal */}
      <CompletionModal
        open={showCompletionModal}
        job={job}
        timesheetEntries={timesheetData?.entries ?? []}
        onClose={() => setShowCompletionModal(false)}
        onComplete={(workSummary) => handleStatusUpdate("completed", workSummary)}
      />

      {/* Edit Modal */}
      <EditJobModal
        open={showEditModal}
        job={job}
        onClose={() => setShowEditModal(false)}
        onSaved={() => qc.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] })}
      />
    </Stack>
  );
}
