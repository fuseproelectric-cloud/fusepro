import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodSchema } from "zod";
import { FormSection } from "./FormSection";
import { FormRow } from "./FormRow";
import { FormActions } from "./FormActions";
import { TextInput } from "./inputs/TextInput";
import { NumberInput } from "./inputs/NumberInput";
import { TextareaInput } from "./inputs/TextareaInput";
import { SelectInput, type SelectOption } from "./inputs/SelectInput";
import { DateInput } from "./inputs/DateInput";
import { CheckboxInput } from "./inputs/CheckboxInput";
import { Controller } from "react-hook-form";

// ── Типы конфига полей ────────────────────────────────────────────────────────

type BaseField = {
  name:       string;
  label:      string;
  required?:  boolean;
  placeholder?: string;
  hint?:      string;
  disabled?:  boolean;
  /** Колонок в строке (если используется FormRow внутри секции) */
  colSpan?:   number;
};

type TextField     = BaseField & { type: "text" | "email" | "password" };
type NumberField   = BaseField & { type: "number"; prefix?: string; suffix?: string };
type TextareaField = BaseField & { type: "textarea"; rows?: number };
type SelectField   = BaseField & { type: "select"; options: SelectOption[] };
type DateField     = BaseField & { type: "date" | "time" | "datetime-local" };
type CheckboxField = BaseField & { type: "checkbox" };

export type FieldConfig =
  | TextField | NumberField | TextareaField
  | SelectField | DateField | CheckboxField;

// ── Конфиг секции ─────────────────────────────────────────────────────────────

export type SectionConfig = {
  title?: string;
  /** Кол-во колонок в этой секции (default 1) */
  cols?:  1 | 2 | 3 | 4;
  fields: FieldConfig[];
};

// ── Props SchemaForm ──────────────────────────────────────────────────────────

interface SchemaFormProps<T extends Record<string, unknown>> {
  schema:       ZodSchema<T>;
  sections:     SectionConfig[];
  defaultValues?: Partial<T>;
  onSubmit:     (data: T) => void | Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?:    () => void;
  loading?:     boolean;
}

/**
 * Schema-driven форма для простых случаев.
 *
 * Пример:
 *   const SECTIONS: SectionConfig[] = [{
 *     title: "User Info",
 *     cols: 2,
 *     fields: [
 *       { name: "name",  type: "text",  label: "Name",  required: true },
 *       { name: "email", type: "email", label: "Email", required: true },
 *       { name: "role",  type: "select", label: "Role",
 *         options: [{ value: "admin", label: "Admin" }] },
 *     ],
 *   }];
 *
 *   <SchemaForm
 *     schema={userSchema}
 *     sections={SECTIONS}
 *     onSubmit={onSave}
 *     onCancel={onClose}
 *     loading={isPending}
 *   />
 */
export function SchemaForm<T extends Record<string, unknown>>({
  schema, sections, defaultValues, onSubmit, submitLabel, cancelLabel, onCancel, loading,
}: SchemaFormProps<T>) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} noValidate className="space-y-5">
      {sections.map((sec, si) => (
        <FormSection key={si} title={sec.title}>
          {(sec.cols ?? 1) > 1 ? (
            <FormRow cols={sec.cols}>
              {sec.fields.map(f => renderField(f, register, control, errors))}
            </FormRow>
          ) : (
            sec.fields.map(f => renderField(f, register, control, errors))
          )}
        </FormSection>
      ))}
      <FormActions
        submitLabel={submitLabel}
        onCancel={onCancel}
        cancelLabel={cancelLabel}
        loading={loading}
      />
    </form>
  );
}

// ── Рендер одного поля ────────────────────────────────────────────────────────

function renderField(f: FieldConfig, register: any, control: any, errors: any) {
  const err = errors[f.name];

  if (f.type === "select") {
    return (
      <Controller key={f.name} name={f.name} control={control} render={({ field }) => (
        <SelectInput
          label={f.label}
          options={f.options}
          value={field.value as string}
          onValueChange={field.onChange}
          placeholder={f.placeholder}
          error={err}
          required={f.required}
          hint={f.hint}
          disabled={f.disabled}
        />
      )} />
    );
  }

  if (f.type === "checkbox") {
    return (
      <Controller key={f.name} name={f.name} control={control} render={({ field }) => (
        <CheckboxInput
          label={f.label}
          checked={field.value as boolean}
          onCheckedChange={field.onChange}
          error={err}
          hint={f.hint}
          disabled={f.disabled}
        />
      )} />
    );
  }

  if (f.type === "textarea") {
    return (
      <TextareaInput
        key={f.name}
        label={f.label}
        rows={f.rows}
        required={f.required}
        placeholder={f.placeholder}
        hint={f.hint}
        disabled={f.disabled}
        error={err}
        {...register(f.name)}
      />
    );
  }

  if (f.type === "number") {
    return (
      <NumberInput
        key={f.name}
        label={f.label}
        required={f.required}
        placeholder={f.placeholder}
        hint={f.hint}
        disabled={f.disabled}
        prefix={f.prefix}
        suffix={f.suffix}
        error={err}
        {...register(f.name)}
      />
    );
  }

  if (f.type === "date" || f.type === "time" || f.type === "datetime-local") {
    return (
      <DateInput
        key={f.name}
        label={f.label}
        variant={f.type}
        required={f.required}
        hint={f.hint}
        disabled={f.disabled}
        error={err}
        {...register(f.name)}
      />
    );
  }

  // text | email | password
  return (
    <TextInput
      key={f.name}
      label={f.label}
      type={f.type}
      required={f.required}
      placeholder={f.placeholder}
      hint={f.hint}
      disabled={f.disabled}
      error={err}
      {...register(f.name)}
    />
  );
}
