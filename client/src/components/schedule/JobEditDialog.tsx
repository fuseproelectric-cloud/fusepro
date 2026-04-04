import { useState } from "react";
import { format } from "date-fns";
import { X, Loader2, Calendar, User, ExternalLink } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { AddressSelector } from "@/components/AddressSelector";
import { cn, formatStatus, statusChipSx, priorityChipSx } from "@/lib/utils";
import Chip from "@mui/material/Chip";
import { getTechName } from "@/lib/schedule/job-utils";
import type { Job } from "@shared/schema";
import type { TechWithUser, Customer } from "@/lib/schedule/job-utils";

// ── Inline editable text ─────────────────────────────────────────────────────
function InlineText({
  value, onSave, placeholder, multiline, className,
}: {
  value: string; onSave: (v: string) => void;
  placeholder?: string; multiline?: boolean; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };

  if (!editing) {
    return (
      <span
        className={cn(
          "cursor-text rounded px-0.5 -mx-0.5 hover:bg-muted/50 transition-colors",
          !value && "text-muted-foreground/60 italic",
          className
        )}
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        {value || placeholder || "—"}
      </span>
    );
  }
  if (multiline) {
    return (
      <Textarea
        autoFocus value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit} rows={2}
        className="resize-none text-sm w-full" placeholder={placeholder}
      />
    );
  }
  return (
    <Input
      autoFocus value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      className={cn("h-7 text-sm px-1.5", className)} placeholder={placeholder}
    />
  );
}

// ── Main dialog ──────────────────────────────────────────────────────────────

interface JobEditDialogProps {
  job: Job;
  technicians: TechWithUser[];
  customers: Customer[];
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}

export function JobEditDialog({ job, technicians, customers, onClose, onSave }: JobEditDialogProps) {
  const [, navigate] = useLocation();
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState<number | null>(job.customerId ?? null);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [dateStr, setDateStr] = useState(
    job.scheduledAt ? format(new Date(job.scheduledAt), "yyyy-MM-dd") : ""
  );
  const [timeStr, setTimeStr] = useState(
    job.scheduledAt ? format(new Date(job.scheduledAt), "HH:mm") : "09:00"
  );
  const [endTimeStr, setEndTimeStr] = useState(() => {
    if (!job.scheduledAt) return "10:00";
    const end = new Date(new Date(job.scheduledAt).getTime() + (job.estimatedDuration ?? 60) * 60_000);
    return format(end, "HH:mm");
  });

  const tech = technicians.find(t => t.id === job.technicianId);

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try { await onSave(patch); } finally { setSaving(false); }
  };

  const saveScheduled = (d: string, t: string, end: string) => {
    if (!d) return;
    const startMs = new Date(`${d}T${t}:00`).getTime();
    const endMs   = new Date(`${d}T${end}:00`).getTime();
    const dur     = Math.max(15, Math.round((endMs - startMs) / 60_000));
    save({ scheduledAt: new Date(`${d}T${t}:00`).toISOString(), estimatedDuration: dur });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-t-2xl sm:rounded-xl w-full sm:max-w-md shadow-high max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border/60 px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground leading-tight">
              <InlineText value={job.title} onSave={v => save({ title: v })} placeholder="Job title" className="font-bold" />
            </h2>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <Chip size="small" label={formatStatus(job.status)} sx={statusChipSx(job.status)} />
              {job.priority && (
                <Chip size="small" label={formatStatus(job.priority)} sx={priorityChipSx(job.priority)} />
              )}
              {saving && <Icon icon={Loader2} size={14} className="animate-spin text-muted-foreground/60 mt-0.5" />}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-muted-foreground flex-shrink-0 mt-0.5">
            <Icon icon={X} size={20} />
          </button>
        </div>

        <div className="p-5 space-y-0 divide-y divide-slate-100">
          {/* Status */}
          <div className="flex items-center gap-3 py-3">
            <span className="text-xs text-muted-foreground/60 w-20 flex-shrink-0">Status</span>
            <Select value={job.status} onValueChange={v => save({ status: v })}>
              <SelectTrigger className="h-7 text-sm border-0 shadow-none p-0 gap-1 hover:bg-muted/50 rounded focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-3 py-3">
            <span className="text-xs text-muted-foreground/60 w-20 flex-shrink-0">Priority</span>
            <Select value={job.priority ?? "normal"} onValueChange={v => save({ priority: v })}>
              <SelectTrigger className="h-7 text-sm border-0 shadow-none p-0 gap-1 hover:bg-muted/50 rounded focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date / Start – End time */}
          <div className="flex items-center gap-2 py-3 flex-wrap">
            <Icon icon={Calendar} size={16} className="text-muted-foreground/60 flex-shrink-0" />
            <input type="date" value={dateStr}
              onChange={e => { setDateStr(e.target.value); saveScheduled(e.target.value, timeStr, endTimeStr); }}
              className="text-sm text-muted-foreground bg-transparent border-0 outline-none cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
            />
            <input type="time" value={timeStr}
              onChange={e => { setTimeStr(e.target.value); saveScheduled(dateStr, e.target.value, endTimeStr); }}
              className="text-sm text-muted-foreground bg-transparent border-0 outline-none cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
            />
            <span className="text-xs text-muted-foreground/50">–</span>
            <input type="time" value={endTimeStr}
              onChange={e => { setEndTimeStr(e.target.value); saveScheduled(dateStr, timeStr, e.target.value); }}
              className="text-sm text-muted-foreground bg-transparent border-0 outline-none cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
            />
          </div>

          {/* Customer */}
          <div className="flex items-center gap-3 py-3">
            <Icon icon={User} size={16} className="text-muted-foreground/60 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <CustomerCombobox
                customers={customers as any}
                value={customerId}
                onChange={id => { setCustomerId(id); setAddressId(null); save({ customerId: id }); }}
                placeholder="No customer"
              />
            </div>
          </div>

          {/* Technician */}
          <div className="flex items-center gap-3 py-3">
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tech?.color ?? "#d1d5db" }} />
            </div>
            <Select
              value={job.technicianId ? String(job.technicianId) : "none"}
              onValueChange={v => save({
                technicianId: v === "none" ? null : Number(v),
                status: v === "none" ? "pending" : "assigned",
              })}
            >
              <SelectTrigger className="h-7 text-sm border-0 shadow-none p-0 gap-1 hover:bg-muted/50 rounded focus:ring-0">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {technicians.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>{getTechName(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          {customerId && (
            <div className="py-3">
              <AddressSelector
                customerId={customerId}
                value={addressId}
                onChange={(id, addr) => {
                  setAddressId(id);
                  if (addr) save({ address: addr.address ?? null, city: addr.city ?? null, state: addr.state ?? null, zip: addr.zip ?? null });
                }}
              />
            </div>
          )}

          {/* Notes */}
          <div className="flex items-start gap-3 py-3">
            <span className="text-xs text-muted-foreground/60 w-20 flex-shrink-0 mt-0.5">Notes</span>
            <div className="flex-1 text-sm">
              <InlineText value={job.notes ?? ""} onSave={v => save({ notes: v || null })} placeholder="Add notes..." multiline />
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 pb-safe">
          <Button
            className="w-full h-10 bg-blue-500 hover:bg-blue-700 text-white font-semibold"
            onClick={() => { onClose(); navigate(`/job/${job.id}`); }}
          >
            <Icon icon={ExternalLink} size={16} className="mr-2" /> Open Full Details
          </Button>
        </div>
      </div>
    </div>
  );
}
