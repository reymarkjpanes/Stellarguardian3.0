/**
 * Structured JSON logger for server-side operations (Req 20).
 *
 * Outputs JSON lines in production; readable format in development.
 * Includes timestamp, level, message, and optional context fields.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV === "development";

function formatEntry(entry: LogEntry): string {
  if (isDev) {
    const { timestamp, level, message, ...rest } = entry;
    const ctx = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
    return `[${level.toUpperCase()}] ${message}${ctx}`;
  }
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const formatted = formatEntry(entry);

  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "debug":
      if (isDev) console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => log("error", message, context),
};
