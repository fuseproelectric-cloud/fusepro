import React, { useState, useEffect } from "react";
import type { FieldError } from "react-hook-form";
import { cn } from "@/lib/utils";

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label:      string;
  error?:     FieldError | string;
  required?:  boolean;
  hint?:      string;
  wrapClass?: string;
  /** Symbol displayed to the left of the value, e.g. "$" */
  prefix?:    string;
  /** Symbol displayed to the right of the value, e.g. "min" */
  suffix?:    string;
}

/**
 * Number input with floating label and optional prefix / suffix.
 *
 * Prefix / suffix are pinned to the bottom of the field (content area)
 * so they never overlap the floating label at the top.
 *
 * RHF: <NumberInput label="Price" prefix="$" step="0.01" error={errors.price} {...register("price")} />
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      label, error, required, hint, wrapClass,
      className, onFocus, onBlur, onChange,
      prefix, suffix,
      value, defaultValue,
      ...props
    },
    ref,
  ) => {
    const id       = React.useId();
    const msg      = typeof error === "string" ? error : error?.message;
    const hasError = !!msg;

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
        {/* Prefix — anchored to the bottom-left of the field (content area) */}
        {prefix && (
          <span
            className="absolute left-3 bottom-[0.45rem] text-sm text-muted-foreground pointer-events-none select-none z-10"
            aria-hidden="true"
          >
            {prefix}
          </span>
        )}

        <input
          id={id}
          ref={ref}
          type="number"
          value={value}
          defaultValue={defaultValue}
          placeholder=" "
          className={cn(
            "field-input",
            prefix && "pl-7",
            suffix && "pr-10",
            className,
          )}
          onFocus={e => { setFocused(true); onFocus?.(e); }}
          onBlur={e => { setFocused(false); onBlur?.(e); }}
          onChange={e => {
            setFilledState(e.target.value !== "");
            onChange?.(e);
          }}
          onAnimationStart={e => {
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

        {/* Suffix — anchored to the bottom-right of the field */}
        {suffix && (
          <span
            className="absolute right-3 bottom-[0.45rem] text-sm text-muted-foreground pointer-events-none select-none"
            aria-hidden="true"
          >
            {suffix}
          </span>
        )}

        {msg  && <p id={`${id}-err`}  role="alert" className="mt-1 text-sm text-destructive">{msg}</p>}
        {hint && !msg && <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
    );
  },
);
NumberInput.displayName = "NumberInput";
