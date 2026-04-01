import React, { useState, useEffect } from "react";
import type { FieldError } from "react-hook-form";
import { cn } from "@/lib/utils";

export interface TextareaInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label:      string;
  error?:     FieldError | string;
  required?:  boolean;
  hint?:      string;
  wrapClass?: string;
}

/**
 * Multi-line textarea with floating label.
 *
 * Two rendering modes:
 *   • label present  → floating label (MUI outlined style)
 *   • label=""       → plain textarea with regular placeholder, used for
 *                      notes / description fields inside named <FormSection>
 */
export const TextareaInput = React.forwardRef<HTMLTextAreaElement, TextareaInputProps>(
  (
    {
      label, error, required, hint, wrapClass,
      className, onFocus, onBlur, onChange, rows = 3,
      value, defaultValue,
      ...props
    },
    ref,
  ) => {
    const id       = React.useId();
    const msg      = typeof error === "string" ? error : error?.message;
    const hasError = !!msg;

    // Hooks must always be called, regardless of the label-empty branch below
    const [focused, setFocused] = useState(false);
    const isControlled = value !== undefined;
    const [filledState, setFilledState] = useState(() => {
      const v = value ?? defaultValue;
      return v !== undefined && String(v) !== "";
    });

    useEffect(() => {
      if (isControlled) setFilledState(value !== "" && value !== null && value !== undefined);
    }, [value, isControlled]);

    const filled = isControlled
      ? (value !== "" && value !== null && value !== undefined)
      : filledState;

    // ── Plain mode (empty label) ────────────────────────────────────────────
    // Used for notes / description fields nested inside a named <FormSection>.
    if (!label) {
      return (
        <div className={cn("relative", wrapClass)}>
          <textarea
            id={id}
            ref={ref}
            rows={rows}
            value={value}
            defaultValue={defaultValue}
            className={cn(
              "w-full rounded-[10px] border-[1.5px] bg-transparent",
              "px-3 py-2.5 text-sm resize-none outline-none",
              "placeholder:text-muted-foreground transition-colors duration-150",
              hasError
                ? "border-destructive focus:border-destructive"
                : "border-input focus:border-primary",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
            onChange={onChange}
            aria-invalid={hasError || undefined}
            aria-describedby={msg ? `${id}-err` : undefined}
            {...props}
          />
          {msg  && <p id={`${id}-err`}  role="alert" className="mt-1 text-sm text-destructive">{msg}</p>}
          {hint && !msg && <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">{hint}</p>}
        </div>
      );
    }

    // ── Floating label mode ─────────────────────────────────────────────────
    return (
      <div
        className={cn(
          "field field-textarea",
          focused  && "field-focused",
          filled   && "field-filled",
          hasError && "field-error",
          wrapClass,
        )}
      >
        <textarea
          id={id}
          ref={ref}
          rows={rows}
          value={value}
          defaultValue={defaultValue}
          placeholder=" "
          className={cn("field-input", className)}
          onFocus={e => { setFocused(true); onFocus?.(e); }}
          onBlur={e => { setFocused(false); onBlur?.(e); }}
          onChange={e => {
            setFilledState(e.target.value !== "");
            onChange?.(e);
          }}
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
TextareaInput.displayName = "TextareaInput";
