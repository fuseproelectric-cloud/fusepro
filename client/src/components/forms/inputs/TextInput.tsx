import React, { useState, useEffect } from "react";
import type { FieldError } from "react-hook-form";
import { cn } from "@/lib/utils";

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:      string;
  error?:     FieldError | string;
  required?:  boolean;
  hint?:      string;
  wrapClass?: string;
}

/**
 * Text / Email / Password / Color input — MUI Outlined floating label.
 *
 * Label starts inside the field (resting) and floats onto the top border
 * (with a notch cut) when the field is focused or has a value.
 *
 * Fill detection uses four independent mechanisms so it works correctly for:
 *   • Controlled inputs (value prop)
 *   • Uncontrolled RHF register() inputs (onChange tracking)
 *   • RHF values-prop reset (CSS :not(:placeholder-shown) via :has())
 *   • Browser autofill (onAnimationStart + CSS :not(:placeholder-shown))
 *
 * RHF:       <TextInput label="Name" required error={errors.name} {...register("name")} />
 * Controlled: <TextInput label="Email" value={val} onChange={e => setVal(e.target.value)} />
 */
export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label, error, required, hint, wrapClass,
      className, onFocus, onBlur, onChange, type = "text",
      value, defaultValue,
      ...props
    },
    ref,
  ) => {
    const id       = React.useId();
    const msg      = typeof error === "string" ? error : error?.message;
    const hasError = !!msg;

    // ── State ──────────────────────────────────────────────────────────────
    const [focused, setFocused] = useState(false);

    // Tracks whether field has a value (for the .field-filled JS class).
    // CSS :has(:not(:placeholder-shown)) handles most cases automatically,
    // but we still set this flag so the JS class exists for compatibility.
    const isControlled = value !== undefined;
    const [filledState, setFilledState] = useState(() => {
      // Initialise from whichever value source is available
      const v = value ?? defaultValue;
      return v !== undefined && String(v) !== "";
    });

    // Keep in sync when a controlled value changes from outside
    // (e.g., RHF values prop triggering a reset)
    useEffect(() => {
      if (isControlled) setFilledState(value !== "" && value !== null && value !== undefined);
    }, [value, isControlled]);

    const filled = isControlled
      ? (value !== "" && value !== null && value !== undefined)
      : filledState;

    // ── Render ─────────────────────────────────────────────────────────────
    return (
      <div
        className={cn(
          "field",
          focused    && "field-focused",
          filled     && "field-filled",
          hasError   && "field-error",
          wrapClass,
        )}
      >
        <input
          id={id}
          ref={ref}
          type={type}
          value={value}
          defaultValue={defaultValue}
          /* placeholder=" " — invisible; used by CSS :not(:placeholder-shown) */
          placeholder=" "
          className={cn("field-input", className)}
          onFocus={e => { setFocused(true); onFocus?.(e); }}
          onBlur={e => { setFocused(false); onBlur?.(e); }}
          onChange={e => {
            setFilledState(e.target.value !== "");
            onChange?.(e);
          }}
          onAnimationStart={e => {
            // Detect browser autofill (Chrome / Safari inject a CSS animation)
            if (e.animationName === "fieldAutoFillStart")  setFilledState(true);
            if (e.animationName === "fieldAutoFillCancel") setFilledState(false);
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
TextInput.displayName = "TextInput";
