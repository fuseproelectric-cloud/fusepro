import React, { useState } from "react";
import type { FieldError } from "react-hook-form";
import { cn } from "@/lib/utils";

export interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label:      string;
  error?:     FieldError | string;
  required?:  boolean;
  hint?:      string;
  wrapClass?: string;
  /** Input type. Default: "date" */
  variant?:   "date" | "time" | "datetime-local";
}

/**
 * Date / time input with a permanently floating label.
 *
 * Why always floating: native date, time and datetime-local inputs always
 * render browser-native chrome (calendar icon, spinners, format hints) so
 * the field is never visually "empty" in the way a text field is. Keeping
 * the label permanently in the floating position prevents overlap with the
 * native date picker UI on all browsers and platforms.
 *
 * RHF: <DateInput label="Due Date" variant="date" error={errors.dueDate} {...register("dueDate")} />
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      label, error, required, hint, wrapClass,
      className, variant = "date", onFocus, onBlur,
      ...props
    },
    ref,
  ) => {
    const id       = React.useId();
    const msg      = typeof error === "string" ? error : error?.message;
    const hasError = !!msg;
    const [focused, setFocused] = useState(false);

    return (
      /*
        Always carry field-filled so the label is permanently in the floating
        position — date inputs always show browser chrome so resting-inside
        the field would cause overlap on all browsers.
      */
      <div
        className={cn(
          "field field-filled",
          focused  && "field-focused",
          hasError && "field-error",
          wrapClass,
        )}
      >
        <input
          id={id}
          ref={ref}
          type={variant}
          placeholder=" "
          className={cn("field-input", className)}
          onFocus={e => { setFocused(true); onFocus?.(e); }}
          onBlur={e => { setFocused(false); onBlur?.(e); }}
          aria-invalid={hasError || undefined}
          aria-describedby={msg ? `${id}-err` : hint ? `${id}-hint` : undefined}
          {...props}
        />

        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
        </label>

        {msg  && <p id={`${id}-err`}  role="alert" className="mt-1 text-sm text-destructive">{msg}</p>}
        {hint && !msg && <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
    );
  },
);
DateInput.displayName = "DateInput";
