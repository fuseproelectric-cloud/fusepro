import { cn } from "@/lib/utils";
import { F } from "./form-styles";

interface FormSectionProps {
  title?:    string;
  children:  React.ReactNode;
  className?: string;
}

/**
 * Группа полей с заголовком секции.
 *
 * Использование:
 *   <FormSection title="Job Details">
 *     <TextInput ... />
 *   </FormSection>
 */
export function FormSection({ title, children, className }: FormSectionProps) {
  return (
    <div className={cn(F.section, className)}>
      {title && <p className={F.sectionTitle}>{title}</p>}
      {children}
    </div>
  );
}
