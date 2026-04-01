import { cn } from "@/lib/utils";

const COLS = {
  1: "grid-cols-1",
  2: "grid-cols-1",
  3: "grid-cols-1",
  4: "grid-cols-1",
} as const;

interface FormRowProps {
  cols?:     1 | 2 | 3 | 4;
  gap?:      "2" | "3" | "4";
  children:  React.ReactNode;
  className?: string;
}

/**
 * Responsive grid для нескольких полей в строке.
 *
 * Использование:
 *   <FormRow cols={3}>
 *     <TextInput label="City" ... />
 *     <TextInput label="State" ... />
 *     <TextInput label="ZIP" ... />
 *   </FormRow>
 */
export function FormRow({ cols = 2, gap = "3", children, className }: FormRowProps) {
  return (
    <div className={cn("grid", COLS[cols], `gap-${gap}`, className)}>
      {children}
    </div>
  );
}
