/**
 * Extracts a clean error message from a thrown apiRequest error.
 *
 * apiRequest throws with messages like `"409: {"message":"...","error":"..."}"`
 * This strips the leading status code and parses the JSON body.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const body = JSON.parse(raw.replace(/^\d+:\s*/, ""));
    if (body?.message && typeof body.message === "string") return body.message;
  } catch {}
  return raw || fallback;
}
