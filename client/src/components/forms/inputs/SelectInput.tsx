import { useState, useId } from "react";
import type { FieldError } from "react-hook-form";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectInputProps {
  label:         string;
  options:       SelectOption[];
  value?:        string;
  onValueChange: (value: string) => void;
  placeholder?:  string;
  error?:        FieldError | string;
  required?:     boolean;
  hint?:         string;
  disabled?:     boolean;
  wrapClass?:    string;
}

/**
 * Radix-UI Select with floating label (MUI Outlined style).
 *
 * Because Radix SelectTrigger is a <button>, not a native input, CSS
 * :placeholder-shown and :has() do not apply. Both focused and filled
 * states are managed entirely with JS, applying .field-focused / .field-filled
 * classes to the wrapper div.
 *
 * The label floats from inside the trigger (resting) onto the top border
 * (floating) using the same .field-label class and CSS as other inputs.
 * bg-card on the label creates the notch / border-cut effect.
 *
 * RHF (Controller):
 *   <Controller name="status" control={control} render={({ field }) => (
 *     <SelectInput label="Status" options={STATUS_OPTIONS}
 *       value={field.value} onValueChange={field.onChange} error={errors.status} />
 *   )} />
 *
 * Direct:
 *   <SelectInput label="Priority" options={OPTIONS} value={val} onValueChange={setVal} />
 */
export function SelectInput({
  label, options, value, onValueChange,
  error, required, hint, disabled, wrapClass,
}: SelectInputProps) {
  const reactId  = useId();
  const id       = `sel-${reactId.replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);

  const msg      = typeof error === "string" ? error : error?.message;
  const hasError = !!msg;

  // Filled when a real option value is selected
  const filled   = !!(value && value !== "");
  const focused  = open;

  return (
    <div
      className={cn(
        "field",
        focused  && "field-focused",
        filled   && "field-filled",
        hasError && "field-error",
        wrapClass,
      )}
    >
      <Select
        value={value}
        onValueChange={onValueChange}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
      >
        {/*
          SelectTrigger styled to match .field-input visually:
          same height, border-radius, border colour, transition.
          We apply inline Tailwind utilities rather than .field-input
          because SelectTrigger uses Radix's own flex layout internally.
        */}
        <SelectTrigger
          id={id}
          className={cn(
            // h-12 for consistent height with TextInput/NumberInput/DateInput
            // items-center: chevron and value both centred (natural select look)
            // shadow-sm removed (border handles visual weight)
            "h-14 w-full items-center rounded-[10px] border-[1.5px] bg-transparent px-3 text-[1.0625rem]",
            "focus:outline-none focus:ring-0", /* border colour handles focus */
            "transition-colors duration-150",
            hasError
              ? "border-destructive"
              : open
                ? "border-primary"
                : "border-input",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          aria-invalid={hasError || undefined}
          aria-describedby={msg ? `${id}-err` : hint ? `${id}-hint` : undefined}
        >
          {/* No placeholder — the floating label is the visual placeholder */}
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/*
        The .field-label CSS class positions the label inside the trigger
        in resting state (top: 50%; transform: translateY(-50%)) and floats
        it onto the top border when .field-focused or .field-filled is present.
        bg-card is baked into the floating state via .field-label CSS.
      */}
      <label htmlFor={id} className="field-label pointer-events-none select-none">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
      </label>

      {msg  && <p id={`${id}-err`}  role="alert" className="mt-1 text-sm text-destructive">{msg}</p>}
      {hint && !msg && <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
