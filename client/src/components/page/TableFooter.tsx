export interface TableFooterProps {
  filtered: number;
  total: number;
  label: string;
}

export function TableFooter({ filtered, total, label }: TableFooterProps) {
  return (
    <div className="px-4 py-2.5 border-t border-border bg-muted/30">
      <p className="text-xs text-muted-foreground">
        Showing {filtered} of {total} {label}
      </p>
    </div>
  );
}
