/**
 * Structured logger.
 *
 * Outputs consistently formatted lines:
 *   ISO_TIMESTAMP LEVEL [source] message | key=value ...
 *
 * Using console.log/error directly (no external deps) — the format is readable
 * in dev and parseable by common log aggregators in production.
 *
 * Exported `log()` function is kept for backward compatibility.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, string | number | boolean | null | undefined>;

function write(level: LogLevel, message: string, context?: LogContext): void {
  const ts  = new Date().toISOString();
  const lvl = level.toUpperCase().padEnd(5);
  let line  = `${ts} ${lvl} ${message}`;

  if (context) {
    const fields = Object.entries(context)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(" ");
    if (fields) line += ` | ${fields}`;
  }

  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => write("debug", msg, ctx),
  info:  (msg: string, ctx?: LogContext) => write("info",  msg, ctx),
  warn:  (msg: string, ctx?: LogContext) => write("warn",  msg, ctx),
  error: (msg: string, ctx?: LogContext) => write("error", msg, ctx),
};

/** Backward-compatible helper kept for existing callers. */
export function log(message: string, source = "express"): void {
  logger.info(message, { source });
}
