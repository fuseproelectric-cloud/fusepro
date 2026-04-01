import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatStatus, STATUS_COLORS } from "@/lib/utils";
import { buildTechColorMap, getTechName } from "@/lib/schedule/job-utils";
import type { Job } from "@shared/schema";
import type { TechWithUser } from "@/lib/schedule/job-utils";
import type { DragAndDropHandlers } from "@/hooks/useJobDragAndDrop";

interface UnscheduledSidebarProps {
  jobs: Job[];
  technicians: TechWithUser[];
  drag: DragAndDropHandlers;
  onJobClick: (e: React.MouseEvent, job: Job) => void;
  onAssignTech: (jobId: number, techId: number) => void;
}

export function UnscheduledSidebar({
  jobs,
  technicians,
  drag,
  onJobClick,
  onAssignTech,
}: UnscheduledSidebarProps) {
  const colorMap = buildTechColorMap(technicians);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Unscheduled</CardTitle>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {jobs.length}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Drag to a row to assign + schedule</p>
      </CardHeader>

      <CardContent className="space-y-2">
        {jobs.length === 0 ? (
          <p className="text-muted-foreground text-xs text-center py-6">
            All jobs are scheduled
          </p>
        ) : (
          jobs.map(job => (
            <div
              key={job.id}
              draggable
              // Unscheduled jobs have no tech yet — technicianId assigned on drop
              onDragStart={e => drag.onDragStart(e, job.id)}
              onDragEnd={drag.onDragEnd}
              onClick={e => onJobClick(e, job)}
              className={cn(
                "rounded-lg border border-border p-2.5 space-y-1.5",
                "cursor-grab active:cursor-grabbing select-none",
                "hover:border-orange-300 hover:shadow-sm transition-all",
                drag.dragJobId === job.id && "opacity-30 scale-95"
              )}
            >
              <p className="text-sm font-medium text-foreground truncate leading-tight">
                {job.title}
              </p>
              <Badge
                variant="outline"
                className={cn("text-xs border", STATUS_COLORS[job.status])}
              >
                {formatStatus(job.status)}
              </Badge>

              {/* Quick-assign without drag */}
              {technicians.length > 0 && (
                <Select onValueChange={techId => onAssignTech(job.id, Number(techId))}>
                  <SelectTrigger
                    className="h-6 text-xs border-dashed"
                    onClick={e => e.stopPropagation()}
                  >
                    <SelectValue placeholder="Assign tech..." />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map(t => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        {getTechName(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))
        )}

        {/* Technician color legend */}
        {technicians.length > 0 && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Technicians</p>
            {technicians.map(t => (
              <div key={t.id} className="flex items-center gap-2 py-0.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colorMap.get(t.id) ?? "#6b7280" }}
                />
                <span className="text-xs text-foreground truncate">{getTechName(t)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
