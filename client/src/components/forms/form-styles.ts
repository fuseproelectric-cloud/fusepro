/**
 * Единые константы стилей форм.
 * Меняй здесь — изменится во всём проекте.
 */

export const F = {
  // Поля ввода
  input:       "h-9 w-full",
  inputTall:   "h-10 w-full",

  // Лейбл
  label:       "text-xs font-semibold text-foreground",

  // Ошибка под полем
  error:       "text-sm text-destructive mt-1",

  // Подсказка под полем
  hint:        "text-sm text-muted-foreground mt-1",

  // Обёртка одного поля (label + input + error) — used by FormField for custom children
  fieldWrap:   "space-y-1.5",

  // Секция (заголовок + поля) — space-y-5 for taller floating-label inputs
  // (16 px gap lets floating labels breathe without clipping into adjacent fields)
  section:     "space-y-5",
  sectionTitle:"text-[11px] font-bold uppercase tracking-widest text-muted-foreground",

  // Кнопка Submit
  submit:      "bg-blue-500 hover:bg-blue-700 text-white font-semibold",
  submitDanger:"bg-red-500 hover:bg-red-600 text-white font-semibold",
} as const;
