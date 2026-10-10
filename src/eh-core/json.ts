/** Reading `api.php` answers: an object whose fields are checked one by one. */

export type JsonObject = Readonly<Record<string, unknown>>;

export function parseJsonObject(body: string): JsonObject | null {
  try {
    const value: unknown = JSON.parse(body);
    return isJsonObject(value) ? value : null;
  } catch {
    return null;
  }
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** The start of an answer, for an unrecognized result. */
export function excerpt(body: string): string {
  return body.slice(0, 120);
}
