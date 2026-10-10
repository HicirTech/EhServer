/**
 * Structured logs (nfr.md OBS-3): one JSON object a line, every field through the one redactor so
 * that no credential reaches a log (SEC-1).
 */
export interface Logger {
  info(event: string, fields?: Readonly<Record<string, unknown>>): void;
  error(event: string, fields?: Readonly<Record<string, unknown>>): void;
}

/** Field names that hold credentials (ADR-0006 cookies, API keys and tokens), in any case. */
const SecretFields = new Set([
  "ipb_member_id",
  "ipb_pass_hash",
  "igneous",
  "iq",
  "apikey",
  "cookie",
  "authorization",
  "password",
  "token",
]);
const Redacted = "[redacted]";

export function createLogger(write: (line: string) => void, now = () => new Date()): Logger {
  const at =
    (level: "info" | "error") =>
    (event: string, fields: Readonly<Record<string, unknown>> = {}) =>
      write(
        `${JSON.stringify({ ...redactFields(fields), time: now().toISOString(), level, event })}\n`,
      );
  return { info: at("info"), error: at("error") };
}

export function redact(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (Array.isArray(value)) {
    return value.map(redact);
  }

  return typeof value === "object" && value !== null
    ? redactFields(value as Readonly<Record<string, unknown>>)
    : value;
}

function redactFields(fields: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [
      name,
      SecretFields.has(name.toLowerCase()) ? Redacted : redact(value),
    ]),
  );
}
