import { SlidersHorizontal, Plus } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchInput } from "@/components/page";

interface JobsToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
  filterPriority: string;
  onFilterPriorityChange: (v: string) => void;
  onOpenCreate: () => void;
}

export function JobsToolbar({
  search, onSearchChange,
  filterStatus, onFilterStatusChange,
  filterPriority, onFilterPriorityChange,
  onOpenCreate,
}: JobsToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
      <SearchInput value={search} onChange={onSearchChange} placeholder="Search jobs…" />

      <Select value={filterStatus} onValueChange={onFilterStatusChange}>
        <SelectTrigger className="h-8 w-36 text-sm bg-card">
          <Icon icon={SlidersHorizontal} size={14} className="mr-1.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="assigned">Assigned</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filterPriority} onValueChange={onFilterPriorityChange}>
        <SelectTrigger className="h-8 w-36 text-sm bg-card">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="emergency">Emergency</SelectItem>
        </SelectContent>
      </Select>

      <Button onClick={onOpenCreate} className="ml-auto h-8 bg-blue-500 hover:bg-blue-700 text-white text-sm px-3">
        <Icon icon={Plus} size={14} className="mr-1.5" /> New Job
      </Button>
    </div>
  );
}
