/** Every eh-core reading is exactly one of four results (ADR-0003). */

/** Outcome codes (docs/outcomes.md) that eh-core recognizes in an upstream response. */
export type FailureCode =
  | "upstream_rate_limited"
  | "cloudflare_challenge"
  | "upstream_unavailable"
  | "too_fast_warning"
  | "ip_banned"
  | "sad_panda"
  | "gallery_removed"
  | "gallery_unavailable"
  | "invalid_token"
  | "content_warning"
  | "site_error";

export interface Success<T> {
  readonly kind: "success";
  readonly value: T;
}

/** A positively identified empty result: the page says there is nothing. */
export interface Empty<E extends string> {
  readonly kind: "empty";
  readonly reason: E;
}

export interface Failure {
  readonly kind: "failure";
  readonly code: FailureCode;
  /** The site's own words, when it gave any. */
  readonly message: string;
  /** When the site says how long to wait. */
  readonly retryAfterSeconds?: number;
}

export interface Unrecognized {
  readonly kind: "unrecognized";
  /** The selector or field that was missing or could not be read. */
  readonly marker: string;
  /** What the page held there. */
  readonly raw: string;
}

export type ParseResult<T, E extends string = never> =
  | Success<T>
  | Empty<E>
  | Failure
  | Unrecognized;

export function success<T>(value: T): Success<T> {
  return { kind: "success", value };
}

export function empty<E extends string>(reason: E): Empty<E> {
  return { kind: "empty", reason };
}

export function failure(code: FailureCode, message = "", retryAfterSeconds?: number): Failure {
  return retryAfterSeconds === undefined
    ? { kind: "failure", code, message }
    : { kind: "failure", code, message, retryAfterSeconds };
}

export function unrecognized(marker: string, raw = ""): Unrecognized {
  return { kind: "unrecognized", marker, raw };
}

export function isUnrecognized<T>(value: T | Unrecognized): value is Unrecognized {
  return (
    typeof value === "object" && value !== null && "kind" in value && value.kind === "unrecognized"
  );
}

/** Thrown inside `assembling` when a field is missing or unreadable. */
class UnrecognizedField extends Error {
  constructor(
    readonly marker: string,
    readonly raw: string,
  ) {
    super(`unrecognized ${marker}`);
  }
}

/** The decoded value, or an unrecognized result naming where on the page it should have been. */
export function need<T>(value: T | null | undefined, marker: string, raw: string | undefined): T {
  if (value === null || value === undefined) {
    throw new UnrecognizedField(marker, raw ?? "");
  }

  return value;
}

export function assembling<T>(assemble: () => T): T | Unrecognized {
  try {
    return assemble();
  } catch (error) {
    if (error instanceof UnrecognizedField) {
      return unrecognized(error.marker, error.raw);
    }

    throw error;
  }
}
