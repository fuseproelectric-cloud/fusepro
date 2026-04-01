import type { FieldError } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { F } from "../form-styles";

export interface SwitchInputProps {
  label:            string;
  checked?:         boolean;
  onCheckedChange?: (checked: boolean) => void;
  hint?:            string;
  error?:           FieldError | string;
  disabled?:        boolean;
  id?:              string;
  className?:       string;
}

/**
 * Switch (toggle) с лейблом справа.
 *
 * С react-hook-form:
 *   <Controller name="taxable" control={control} render={({ field }) => (
 *     <SwitchInput label="Taxable" checked={field.value} onCheckedChange={field.onChange} />
 *   )} />
 */
export function SwitchInput({
  label, checked, onCheckedChange, hint, error, disabled, id, className,
}: SwitchInputProps) {
  const msg = typeof error === "string" ? error : error?.message;
  const inputId = id ?? `sw-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className={cn("flex items-center justify-between gap-3 py-0.5", className)}>
      <div className="flex-1 min-w-0">
        <Label htmlFor={inputId} className={cn(F.label, "cursor-pointer")}>
          {label}
        </Label>
        {hint  && <p className={F.hint}>{hint}</p>}
        {msg   && <p className={F.error}>{msg}</p>}
      </div>
      <Switch
        id={inputId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}
