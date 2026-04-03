import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import type { DashboardStats } from "@shared/routes";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  UserCheck,
  FileText,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, STATUS_COLORS, PRIORITY_COLORS, formatStatus } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import Stack from "@mui/material/Stack";

interface MetricProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: string;
  sub?: string;
  loading?: boolean;
}

function MetricCard({ label, value, icon, accent, sub, loading }: MetricProps) {
  return (
    <div className="bg-card rounded-lg border border-border px-4 py-3.5 flex items-start justify-between" style={{ boxShadow: "var(--shadow-low)" }}>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-16 mt-1.5" />
        ) : (
          <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums leading-none">{value}</p>
        )}
        {sub && !loading && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", accent)}>
        <Icon icon={icon} size={18} className="text-white" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: dashboardApi.getStats,
    refetchInterval: 30000,
  });

  const chartData = stats?.jobsByStatus?.map((item) => ({
    name: formatStatus(item.status),
    count: item.count,
  })) ?? [];

  return (
    <Stack spacing={3}>

      {/* KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="Total Jobs"       value={stats?.totalJobs ?? 0}                       icon={Briefcase}    accent="bg-orange-500"  loading={isLoading} />
        <MetricCard label="In Progress"      value={stats?.inProgressJobs ?? 0}                  icon={Clock}        accent="bg-blue-500"    loading={isLoading} />
        <MetricCard label="Completed Today"  value={stats?.completedJobsToday ?? 0}              icon={CheckCircle2} accent="bg-green-500"   loading={isLoading} />
        <MetricCard label="Pending"          value={stats?.pendingJobs ?? 0}                     icon={FileText}     accent="bg-amber-500"   loading={isLoading} />
        <MetricCard
          label="Technicians"
          value={stats?.activeTechnicians ?? 0}
          icon={UserCheck}
          accent="bg-purple-500"
          sub={`of ${stats?.totalTechnicians ?? 0} total`}
          loading={isLoading}
        />
        <MetricCard
          label="Monthly Revenue"
          value={formatCurrency(stats?.revenueThisMonth ?? 0)}
          icon={DollarSign}
          accent="bg-emerald-500"
          loading={isLoading}
        />
      </div>

      {/* Middle Row: Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Jobs by Status Chart */}
        <div className="lg:col-span-3 bg-card rounded-lg border border-border" style={{ boxShadow: "var(--shadow-low)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Jobs by Status</h3>
            <Icon icon={TrendingUp} size={16} className="text-muted-foreground" />
          </div>
          <div className="p-4">
            {isLoading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      color: "hsl(var(--foreground))",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
                No job data yet
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="lg:col-span-2 bg-card rounded-lg border border-border" style={{ boxShadow: "var(--shadow-low)" }}>
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
          </div>
          <div className="p-3 space-y-2">
            {[
              { href: "/jobs",       label: "New Job" },
              { href: "/customers",  label: "New Customer" },
              { href: "/estimates",  label: "New Estimate" },
              { href: "/invoices",   label: "New Invoice" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:bg-muted/30 hover:border-orange-200 transition-colors cursor-pointer group">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Icon icon={Plus} size={14} className="text-orange-500" />
                    {label}
                  </span>
                  <Icon icon={ArrowRight} size={14} className="text-muted-foreground group-hover:text-orange-500 transition-colors" />
                </div>
              </Link>
            ))}

            <div className="pt-2 mt-1 border-t border-border">
              <div className="flex justify-between text-xs px-1">
                <span className="text-muted-foreground">Total Customers</span>
                <span className="text-foreground font-semibold">{stats?.totalCustomers ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Jobs Table */}
      <div className="bg-card rounded-lg border border-border" style={{ boxShadow: "var(--shadow-low)" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Recent Jobs</h3>
          <Link href="/jobs">
            <span className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors">
              View all <Icon icon={ArrowRight} size={12} />
            </span>
          </Link>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : stats?.recentJobs && stats.recentJobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Technician</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{job.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{job.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {job.technicianName ?? (
                        <span className="text-xs text-amber-500 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border",
                        STATUS_COLORS[job.status]
                      )}>
                        <Icon icon={Circle} size={6} className="fill-current" />
                        {formatStatus(job.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex text-xs font-medium px-2 py-0.5 rounded-full border",
                        PRIORITY_COLORS[job.priority]
                      )}>
                        {formatStatus(job.priority)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <Icon icon={Briefcase} size={32} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
            <Link href="/jobs">
              <span className="text-sm text-orange-500 hover:text-orange-600 cursor-pointer mt-1 inline-block">
                Create your first job →
              </span>
            </Link>
          </div>
        )}
      </div>
    </Stack>
  );
}
