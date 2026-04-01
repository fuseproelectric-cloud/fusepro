import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { F } from "./form-styles";

interface FormFieldProps {
  label:      string;
  required?:  boolean;
  error?:     string;
  hint?:      string;
  className?: string;
  children:   React.ReactNode;
}

/**
 * Traditional label-above wrapper for custom/composite children that do not
 * implement their own floating label (e.g. CustomerCombobox, AddressSelector,
 * LineItemsEditor, file inputs, colour pickers).
 *
 * The standard input components (TextInput, NumberInput, TextareaInput,
 * DateInput, SelectInput) are self-contained and should NOT be wrapped in
 * FormField — they render their own floating label and error message.
 *
 * Usage:
 *   <FormField label="Client" required>
 *     <CustomerCombobox ... />
 *   </FormField>
 */
export function FormField({ label, required, error, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn(F.fieldWrap, className)}>
      <Label className={F.label}>
        {label}
        {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
      </Label>
      {children}
      {error && <p className={F.error} role="alert">{error}</p>}
      {hint && !error && <p className={F.hint}>{hint}</p>}
    </div>
  );
}
