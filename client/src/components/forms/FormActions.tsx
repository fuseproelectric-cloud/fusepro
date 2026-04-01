import { Loader2 } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { F } from "./form-styles";

interface FormActionsProps {
  /** Текст кнопки submit */
  submitLabel?:  string;
  /** Текст при loading */
  loadingLabel?: string;
  /** Текст кнопки Cancel */
  cancelLabel?:  string;
  onCancel?:     () => void;
  loading?:      boolean;
  disabled?:     boolean;
  /** Красная кнопка для деструктивных действий */
  danger?:       boolean;
  /** Выравнивание: end (по умолчанию) | start | between */
  align?:        "start" | "end" | "between";
  className?:    string;
}

/**
 * Стандартные кнопки формы (Submit + Cancel).
 *
 * Использование:
 *   <FormActions
 *     submitLabel="Create Job"
 *     loading={isPending}
 *     onCancel={onClose}
 *   />
 */
export function FormActions({
  submitLabel  = "Save",
  loadingLabel = "Saving…",
  cancelLabel  = "Cancel",
  onCancel,
  loading      = false,
  disabled     = false,
  danger       = false,
  align        = "end",
  className,
}: FormActionsProps) {
  const alignCls = {
    end:     "justify-end",
    start:   "justify-start",
    between: "justify-between",
  }[align];

  return (
    <div className={cn("flex items-center gap-2 pt-2", alignCls, className)}>
      {onCancel && (
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
      <Button
        type="submit"
        size="sm"
        className={cn("h-9 min-w-[100px]", danger ? F.submitDanger : F.submit)}
        disabled={disabled || loading}
      >
        {loading && <Icon icon={Loader2} size={14} className="animate-spin mr-1.5" />}
        {loading ? loadingLabel : submitLabel}
      </Button>
    </div>
  );
}
