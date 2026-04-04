import { Skeleton } from "@/components/ui/skeleton";

export interface TableSkeletonProps {
  count?: number;
}

export function TableSkeleton({ count = 4 }: TableSkeletonProps) {
  return (
    <div className="p-6 space-y-3">
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
