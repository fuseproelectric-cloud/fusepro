import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { myJobsApi } from "@/lib/api";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isToday,
  isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Job = {
  id: number;
  title: string;
  status: string;
  scheduledAt: string | null;
  customerName?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted/40 text-foreground",
  assigned: "bg-blue-100 text-blue-700",
  in_progress: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export function MySchedulePage() {
  const [, navigate] = useLocation();
  const [weekOffset, setWeekOffset] = useState(0);

  const baseDate = new Date();
  const weekStart = startOfWeek(
    weekOffset === 0 ? baseDate : weekOffset > 0
      ? addWeeks(baseDate, weekOffset)
      : subWeeks(baseDate, Math.abs(weekOffset)),
    { weekStartsOn: 0 }
  );
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs/my"],
    queryFn: myJobsApi.getAll,
  });

  function getJobsForDay(day: Date): Job[] {
    return jobs.filter((j) => {
      if (!j.scheduledAt) return false;
      return isSameDay(new Date(j.scheduledAt), day);
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">My Schedule</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            <Icon icon={ChevronLeft} size={16} />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[130px] text-center">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            <Icon icon={ChevronRight} size={16} />
          </Button>
        </div>
      </div>

      {weekOffset !== 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-orange-500 hover:text-orange-600 -mt-2"
          onClick={() => setWeekOffset(0)}
        >
          Back to current week
        </Button>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Icon icon={Loader2} size={24} className="animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((day) => {
            const dayJobs = getJobsForDay(day);
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "rounded-xl border p-3",
                  today
                    ? "border-orange-300 bg-orange-50"
                    : "border-border bg-card"
                )}
              >
                {/* Day header */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                      today
                        ? "bg-orange-500 text-white"
                        : "bg-muted/40 text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <div>
                    <p className={cn("text-sm font-semibold", today ? "text-orange-700" : "text-foreground")}>
                      {format(day, "EEEE")}
                    </p>
                    {today && (
                      <p className="text-xs text-orange-500">Today</p>
                    )}
                  </div>
                  {dayJobs.length > 0 && (
                    <span className="ml-auto text-xs font-medium text-muted-foreground">
                      {dayJobs.length} job{dayJobs.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Jobs */}
                {dayJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-10">No jobs scheduled</p>
                ) : (
                  <div className="space-y-2 pl-2">
                    {dayJobs.map((job) => (
                      <button
                        key={job.id}
                        className="w-full text-left bg-card border border-border rounded-lg px-3 py-2 hover:border-orange-300 transition-colors"
                        onClick={() => navigate(`/job/${job.id}`)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{job.title}</p>
                            {job.customerName && (
                              <p className="text-xs text-muted-foreground truncate">{job.customerName}</p>
                            )}
                            {job.scheduledAt && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(job.scheduledAt), "h:mm a")}
                              </p>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0",
                              STATUS_COLORS[job.status] ?? "bg-muted/40 text-muted-foreground"
                            )}
                          >
                            {job.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
