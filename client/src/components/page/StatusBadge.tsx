import { cn, formatStatus } from "@/lib/utils";

export interface StatusMap {
  [status: string]: { label: string; cls: string };
}

export interface StatusBadgeProps {
  status: string;
  map: StatusMap;
}

export function StatusBadge({ status, map }: StatusBadgeProps) {
  const m = map[status] ?? { label: formatStatus(status), cls: "bg-muted/40 text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}
