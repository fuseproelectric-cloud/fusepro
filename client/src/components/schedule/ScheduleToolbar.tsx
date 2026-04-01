import { ChevronLeft, ChevronRight, Plus, Calendar, LayoutGrid } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getTechName } from "@/lib/schedule/job-utils";
import type { TechWithUser } from "@/lib/schedule/job-utils";

export type ViewMode = "week" | "day";

interface ScheduleToolbarProps {
  // Week mode
  weekDays:         Date[];
  onPrevWeek:       () => void;
  onNextWeek:       () => void;
  onToday:          () => void;

  // Day / Timeline mode
  selectedDay?:     Date;
  onPrevDay?:       () => void;
  onNextDay?:       () => void;

  // Shared
  viewMode:         ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedTechId:   string;
  technicians:      TechWithUser[];
  onTechChange:     (value: string) => void;
  onNewJob:         () => void;
}

export function ScheduleToolbar({
  weekDays,
  onPrevWeek,
  onNextWeek,
  onToday,
  selectedDay,
  onPrevDay,
  onNextDay,
  viewMode,
  onViewModeChange,
  selectedTechId,
  technicians,
  onTechChange,
  onNewJob,
}: ScheduleToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">

      {/* ── View mode toggle ── */}
      <div className="flex items-center rounded-lg border border-border overflow-hidden">
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
            viewMode === "week"
              ? "bg-orange-500 text-white"
              : "text-muted-foreground hover:bg-muted/50"
          )}
          onClick={() => onViewModeChange("week")}
        >
          <Icon icon={LayoutGrid} size={14} /> Week
        </button>
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-border",
            viewMode === "day"
              ? "bg-orange-500 text-white"
              : "text-muted-foreground hover:bg-muted/50"
          )}
          onClick={() => onViewModeChange("day")}
        >
          <Icon icon={Calendar} size={14} /> Day
        </button>
      </div>

      {/* ── Navigation ── */}
      {viewMode === "week" ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrevWeek}>
            <Icon icon={ChevronLeft} size={16} />
          </Button>
          <button
            className="text-sm font-medium min-w-[180px] text-center px-2 py-1 rounded-lg hover:bg-muted/50"
            onClick={onToday}
          >
            {format(weekDays[0], "MMM d")} – {format(weekDays[6], "MMM d, yyyy")}
          </button>
          <Button variant="outline" size="icon" onClick={onNextWeek}>
            <Icon icon={ChevronRight} size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="text-orange-500" onClick={onToday}>
            Today
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrevDay}>
            <Icon icon={ChevronLeft} size={16} />
          </Button>
          <button
            className="text-sm font-medium min-w-[160px] text-center px-2 py-1 rounded-lg hover:bg-muted/50"
            onClick={onToday}
          >
            {selectedDay ? format(selectedDay, "EEE, MMM d, yyyy") : "—"}
          </button>
          <Button variant="outline" size="icon" onClick={onNextDay}>
            <Icon icon={ChevronRight} size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="text-orange-500" onClick={onToday}>
            Today
          </Button>
        </div>
      )}

      {/* ── Filters + new job ── */}
      <div className="flex items-center gap-2 sm:ml-auto">
        <Select value={selectedTechId} onValueChange={onTechChange}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Technicians" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Technicians</SelectItem>
            {technicians.map(t => (
              <SelectItem key={t.id} value={t.id.toString()}>
                {getTechName(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          onClick={onNewJob}
        >
          <Icon icon={Plus} size={16} className="mr-1" /> New Job
        </Button>
      </div>
    </div>
  );
}
