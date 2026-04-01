import type { FieldError } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { F } from "../form-styles";

export interface CheckboxInputProps {
  label:     string;
  checked?:  boolean;
  onCheckedChange?: (checked: boolean) => void;
  error?:    FieldError | string;
  hint?:     string;
  disabled?: boolean;
  id?:       string;
  className?: string;
}

/**
 * Checkbox с лейблом справа и ошибкой внизу.
 *
 * С react-hook-form Controller:
 *   <Controller name="taxable" control={control} render={({ field }) => (
 *     <CheckboxInput
 *       label="Taxable"
 *       checked={field.value}
 *       onCheckedChange={field.onChange}
 *     />
 *   )} />
 */
export function CheckboxInput({
  label, checked, onCheckedChange, error, hint, disabled, id, className,
}: CheckboxInputProps) {
  const msg = typeof error === "string" ? error : error?.message;
  const inputId = id ?? `cb-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <Checkbox
          id={inputId}
          checked={checked}
          onCheckedChange={v => onCheckedChange?.(Boolean(v))}
          disabled={disabled}
        />
        <Label htmlFor={inputId} className={cn(F.label, "cursor-pointer font-normal")}>
          {label}
        </Label>
      </div>
      {msg  && <p className={F.error}>{msg}</p>}
      {hint && !msg && <p className={F.hint}>{hint}</p>}
    </div>
  );
}
