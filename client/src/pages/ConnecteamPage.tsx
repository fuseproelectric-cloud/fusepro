import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { connecteamApi } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import {
  Zap, CheckCircle2, XCircle, RefreshCw, Users, Briefcase,
  Clock, Settings2, AlertCircle, ExternalLink, ChevronRight,
  MapPin, User, Mail, Phone,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Stack from "@mui/material/Stack";

/* ─── schemas ─────────────────────────────────────────────────────────────── */
const credSchema = z.object({
  clientId:     z.string().min(1, "Required"),
  clientSecret: z.string().min(1, "Required"),
});
type CredForm = z.infer<typeof credSchema>;

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={cn(
      "inline-block w-2 h-2 rounded-full flex-shrink-0",
      ok ? "bg-emerald-500" : "bg-red-500"
    )} />
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border border-border rounded-lg", className)}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
      <span>{children}</span>
      <span className="flex-1 border-t border-border" />
    </p>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export function ConnecteamPage() {
  const qc = useQueryClient();
  const [testStatus, setTestStatus]   = useState<"idle" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg]         = useState("");
  const [syncMsg, setSyncMsg]         = useState("");
  const [showSecret, setShowSecret]   = useState(false);

  /* ── queries ── */
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/integrations/connecteam"],
    queryFn: connecteamApi.getSettings,
  });

  const { data: ctUsers = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["/api/integrations/connecteam/users"],
    queryFn: connecteamApi.getUsers,
    enabled: settings?.hasCredentials === true,
    retry: false,
  });

  const { data: ctJobs = [], isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ["/api/integrations/connecteam/jobs"],
    queryFn: connecteamApi.getJobs,
    enabled: settings?.hasCredentials === true,
    retry: false,
  });

  /* ── form ── */
  const { register, handleSubmit, formState: { errors } } = useForm<CredForm>({
    resolver: zodResolver(credSchema),
    defaultValues: { clientId: settings?.clientId ?? "", clientSecret: "" },
  });

  /* ── mutations ── */
  const saveMutation = useMutation({
    mutationFn: connecteamApi.saveSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integrations/connecteam"] });
      qc.invalidateQueries({ queryKey: ["/api/integrations/connecteam/users"] });
      qc.invalidateQueries({ queryKey: ["/api/integrations/connecteam/jobs"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: connecteamApi.testConnection,
    onSuccess: (d) => { setTestStatus("ok"); setTestMsg(d.message); },
    onError: (e: any) => { setTestStatus("fail"); setTestMsg(e.message ?? "Failed"); },
  });

  const syncMutation = useMutation({
    mutationFn: connecteamApi.syncEmployees,
    onSuccess: (d) => {
      setSyncMsg(`${d.message}`);
      qc.invalidateQueries({ queryKey: ["/api/technicians"] });
      qc.invalidateQueries({ queryKey: ["/api/integrations/connecteam"] });
    },
    onError: (e: any) => setSyncMsg(e.message ?? "Sync failed"),
  });

  const onSaveCreds = (data: CredForm) => {
    saveMutation.mutate({ clientId: data.clientId, clientSecret: data.clientSecret, enabled: true });
    setTestStatus("idle");
    setSyncMsg("");
  };

  if (settingsLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isConnected = settings?.hasCredentials;

  return (
    <Stack spacing={3} sx={{ maxWidth: 896, mx: "auto" }}>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Icon icon={Zap} size={16} className="text-orange-500" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Connecteam Integration</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10.5">
            Sync employees, jobs and time tracking between FusPro and Connecteam
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot ok={!!isConnected} />
          <span className={cn("text-xs font-semibold", isConnected ? "text-emerald-600" : "text-red-500")}>
            {isConnected ? "Connected" : "Not connected"}
          </span>
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="h-9 bg-muted/40">
          <TabsTrigger value="settings" className="text-xs gap-1.5"><Icon icon={Settings2} size={14} />Settings</TabsTrigger>
          <TabsTrigger value="employees" className="text-xs gap-1.5" disabled={!isConnected}><Icon icon={Users} size={14} />Employees</TabsTrigger>
          <TabsTrigger value="jobs" className="text-xs gap-1.5" disabled={!isConnected}><Icon icon={Briefcase} size={14} />Jobs</TabsTrigger>
          <TabsTrigger value="time" className="text-xs gap-1.5" disabled={!isConnected}><Icon icon={Clock} size={14} />Time Clock</TabsTrigger>
        </TabsList>

        {/* ── Settings tab ── */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card className="p-5">
            <SectionTitle>API Credentials</SectionTitle>
            <p className="text-xs text-muted-foreground mb-4">
              Find these in <strong>Connecteam → Settings → Integrations → API Keys</strong>
            </p>
            <form onSubmit={handleSubmit(onSaveCreds)} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Client ID</Label>
                <Input
                  {...register("clientId")}
                  placeholder="ct_atvcg..."
                  defaultValue={settings?.clientId ?? ""}
                  className="h-9 font-mono text-sm"
                />
                {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Client Secret</Label>
                <div className="relative">
                  <Input
                    {...register("clientSecret")}
                    type={showSecret ? "text" : "password"}
                    placeholder={settings?.clientSecretMasked || "Enter new secret to update…"}
                    className="h-9 font-mono text-sm pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? "Hide" : "Show"}
                  </button>
                </div>
                {errors.clientSecret && <p className="text-xs text-destructive">{errors.clientSecret.message}</p>}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="submit"
                  className="h-8 bg-orange-500 hover:bg-orange-600 text-white text-xs px-4"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? "Saving…" : "Save Credentials"}
                </Button>
                {saveMutation.isSuccess && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <Icon icon={CheckCircle2} size={14} /> Saved
                  </span>
                )}
              </div>
            </form>
          </Card>

          {/* Test connection */}
          <Card className="p-5">
            <SectionTitle>Connection Test</SectionTitle>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !isConnected}
              >
                {testMutation.isPending
                  ? <><Icon icon={RefreshCw} size={14} className="mr-1.5 animate-spin" />Testing…</>
                  : <><Icon icon={Zap} size={14} className="mr-1.5" />Test Connection</>
                }
              </Button>
              {testStatus === "ok" && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <Icon icon={CheckCircle2} size={14} /> {testMsg}
                </span>
              )}
              {testStatus === "fail" && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <Icon icon={XCircle} size={14} /> {testMsg}
                </span>
              )}
            </div>
          </Card>

          {/* Status card */}
          {settings?.lastSync && (
            <Card className="p-5">
              <SectionTitle>Sync Status</SectionTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon icon={Clock} size={14} />
                Last sync: <span className="font-medium text-foreground">{formatDate(settings.lastSync)}</span>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── Employees tab ── */}
        <TabsContent value="employees" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {ctUsers.length} employee{ctUsers.length !== 1 ? "s" : ""} in Connecteam
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => refetchUsers()}
                disabled={usersLoading}
              >
                <Icon icon={RefreshCw} size={14} className={cn("mr-1.5", usersLoading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                size="sm"
                className="h-8 bg-orange-500 hover:bg-orange-600 text-white text-xs"
                onClick={() => { setSyncMsg(""); syncMutation.mutate(); }}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending
                  ? <><Icon icon={RefreshCw} size={14} className="mr-1.5 animate-spin" />Syncing…</>
                  : <><Icon icon={Users} size={14} className="mr-1.5" />Sync to FusPro</>
                }
              </Button>
            </div>
          </div>

          {syncMsg && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-xs",
              syncMsg.includes("failed") || syncMsg.includes("Failed")
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            )}>
              {syncMsg.includes("failed") ? <Icon icon={XCircle} size={14} /> : <Icon icon={CheckCircle2} size={14} />}
              {syncMsg}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground bg-muted/30 border border-border rounded px-3 py-2 flex items-start gap-1.5">
            <Icon icon={AlertCircle} size={14} className="flex-shrink-0 mt-0.5" />
            New employees are created as technicians with temporary password <strong>FusePro123!</strong>. Already existing emails are skipped.
          </p>

          <Card>
            {usersLoading ? (
              <div className="p-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ctUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No employees found</div>
            ) : (
              <div className="divide-y divide-border">
                {ctUsers.map((u: any) => (
                  <div key={u.userId} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Icon icon={User} size={16} className="text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{u.firstName} {u.lastName}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {u.email && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Icon icon={Mail} size={12} />{u.email}
                          </span>
                        )}
                        {u.phoneNumber && (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Icon icon={Phone} size={12} />{u.phoneNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full",
                      u.userType === "owner"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {u.userType}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Jobs tab ── */}
        <TabsContent value="jobs" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {ctJobs.length} job{ctJobs.length !== 1 ? "s" : ""} in Connecteam
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => refetchJobs()}
              disabled={jobsLoading}
            >
              <Icon icon={RefreshCw} size={14} className={cn("mr-1.5", jobsLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          <Card>
            {jobsLoading ? (
              <div className="p-6 flex justify-center">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ctJobs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No jobs found</div>
            ) : (
              <div className="divide-y divide-border">
                {ctJobs.map((j: any) => (
                  <div key={j.jobId} className="flex items-start gap-3 px-4 py-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                      style={{ backgroundColor: j.color ?? "#f97316" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{j.title}</p>
                      {j.gps?.address && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Icon icon={MapPin} size={12} className="flex-shrink-0" />
                          {j.gps.address}
                        </p>
                      )}
                      {j.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{j.description}</p>
                      )}
                    </div>
                    {j.subJobs?.length > 0 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Icon icon={ChevronRight} size={12} />
                        {j.subJobs.length} sub
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Time Clock tab ── */}
        <TabsContent value="time" className="mt-4">
          <TimeClockTab />
        </TabsContent>
      </Tabs>
    </Stack>
  );
}

/* ─── Time Clock sub-tab ─────────────────────────────────────────────────── */
function TimeClockTab() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate,   setEndDate]   = useState(today.toISOString().slice(0, 10));

  const { data: timeData, isLoading, refetch } = useQuery({
    queryKey: ["/api/integrations/connecteam/time", startDate, endDate],
    queryFn: () => connecteamApi.getTime(startDate, endDate),
    retry: false,
  });

  const entries: any[] = Array.isArray(timeData)
    ? timeData
    : (timeData?.timeActivities ?? timeData?.activities ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">From</Label>
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="h-8 text-sm w-36"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">To</Label>
          <Input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="h-8 text-sm w-36"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <Icon icon={RefreshCw} size={14} className={cn("mr-1.5", isLoading && "animate-spin")} />
          Load
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6 flex justify-center">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <Icon icon={Clock} size={32} className="text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No time entries for this period</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            <div className="grid grid-cols-4 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/20">
              <span>Employee</span>
              <span>Start</span>
              <span>End</span>
              <span>Duration</span>
            </div>
            {entries.map((e: any, i: number) => {
              const start  = e.startTime  ? new Date(e.startTime)  : null;
              const end    = e.endTime    ? new Date(e.endTime)    : null;
              const durMin = e.durationMinutes ?? (start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : null);
              const hours  = durMin != null ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` : "—";
              return (
                <div key={i} className="grid grid-cols-4 px-4 py-2.5 text-xs items-center">
                  <span className="font-medium text-foreground">{e.userName ?? e.userId ?? "—"}</span>
                  <span className="text-muted-foreground">{start ? start.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                  <span className="text-muted-foreground">{end   ? end.toLocaleString("en-US",   { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Active"}</span>
                  <span className="font-semibold text-foreground">{hours}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
