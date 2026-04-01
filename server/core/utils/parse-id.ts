/** Parse a route/body param as a positive integer. Returns null if invalid. */
export function parseId(val: unknown): number | null {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}
