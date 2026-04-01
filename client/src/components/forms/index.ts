// Строительные блоки
export { FormField }   from "./FormField";
export { FormSection } from "./FormSection";
export { FormRow }     from "./FormRow";
export { FormActions } from "./FormActions";

// Schema-driven (простые формы)
export { SchemaForm }  from "./SchemaForm";
export type { SectionConfig, FieldConfig } from "./SchemaForm";

// Готовые input-компоненты
export { TextInput }     from "./inputs/TextInput";
export { NumberInput }   from "./inputs/NumberInput";
export { TextareaInput } from "./inputs/TextareaInput";
export { SelectInput }   from "./inputs/SelectInput";
export { DateInput }     from "./inputs/DateInput";
export { CheckboxInput } from "./inputs/CheckboxInput";
export { SwitchInput }   from "./inputs/SwitchInput";
export type { SelectOption } from "./inputs/SelectInput";

// Стили (если нужно переопределить в конкретном месте)
export { F } from "./form-styles";
