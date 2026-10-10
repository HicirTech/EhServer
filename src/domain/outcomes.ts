/**
 * The outcome catalog of docs/outcomes.md section 4 in code: for each code, its kind, the HTTP status
 * a client gets and what the client should do. A test keeps it in step with the document.
 */
export type OutcomeKind =
  | "success"
  | "empty"
  | "degraded"
  | "failure"
  | "unrecognized"
  | "unconfirmed";

export type ClientAction = "none" | "retry_after" | "retry_same_key" | "user_action" | "give_up";

export interface CatalogEntry {
  readonly kind: OutcomeKind;
  /** Null when nothing is sent back. */
  readonly status: number | null;
  readonly clientAction: ClientAction | null;
  /** A problem response's `title`. */
  readonly title: string;
}

function entry(
  kind: OutcomeKind,
  status: number | null,
  clientAction: ClientAction | null,
  title: string,
): CatalogEntry {
  return { kind, status, clientAction, title };
}

/** Every outcome of an upstream exchange. */
export const Outcomes = {
  ok: entry("success", 200, "none", "OK"),
  ok_empty: entry("empty", 200, "none", "Nothing found"),
  ok_degraded: entry("degraded", 200, "none", "Served below the variant asked for"),
  cancelled: entry("failure", null, null, "Cancelled"),
  network: entry("failure", 502, "retry_after", "No answer from the site"),
  upstream_rate_limited: entry("failure", 503, "retry_after", "Rate limited by the site"),
  cloudflare_challenge: entry("failure", 503, "retry_after", "Cloudflare challenge"),
  upstream_unavailable: entry("failure", 503, "retry_after", "Site unavailable"),
  too_fast_warning: entry("failure", 503, "retry_after", "Pages opened too fast"),
  ip_banned: entry("failure", 503, "retry_after", "IP banned"),
  ip_degraded: entry("failure", 503, "retry_after", "IP held to low resolution"),
  quota_exhausted: entry("failure", 503, "retry_after", "Image quota used up"),
  insufficient_gp: entry("failure", 409, "user_action", "Not enough GP"),
  gp_budget_exceeded: entry("failure", 409, "user_action", "Over the GP budget"),
  signed_out: entry("failure", 409, "user_action", "Signed out"),
  sad_panda: entry("failure", 409, "user_action", "No ExHentai access"),
  no_hath_client: entry("failure", 409, "user_action", "No H@H client"),
  gallery_removed: entry("failure", 404, "give_up", "Gallery removed"),
  gallery_unavailable: entry("failure", 404, "give_up", "Gallery unavailable"),
  invalid_token: entry("failure", 404, "give_up", "Invalid token"),
  content_warning: entry("failure", 502, "retry_after", "Content warning"),
  site_error: entry("failure", 502, "give_up", "Site error"),
  integrity_mismatch: entry("failure", 502, "retry_after", "File does not match"),
  egress_unavailable: entry("failure", 503, "retry_after", "Egress unavailable"),
  egress_cooldown: entry("failure", 503, "retry_after", "Egress cooling down"),
  upstream_unrecognized: entry("unrecognized", 502, "retry_after", "Unrecognized answer"),
  write_unconfirmed: entry("unconfirmed", 502, "retry_same_key", "Write not confirmed"),
} satisfies Readonly<Record<string, CatalogEntry>>;

/** EhServer's own conditions, which use ordinary statuses. */
export const ServerConditions = {
  invalid_request: entry("failure", 400, "give_up", "Invalid request"),
  unauthorized: entry("failure", 401, "user_action", "Unauthorized"),
  forbidden: entry("failure", 403, "user_action", "Forbidden"),
  not_found: entry("failure", 404, "give_up", "Not found"),
  method_not_allowed: entry("failure", 405, "give_up", "Method not allowed"),
  client_rate_limited: entry("failure", 429, "retry_after", "Too many requests"),
  internal_error: entry("failure", 500, "give_up", "Internal error"),
  not_implemented: entry("failure", 501, "give_up", "Not implemented"),
} satisfies Readonly<Record<string, CatalogEntry>>;

export type OutcomeCode = keyof typeof Outcomes;

/** The codes a problem response can carry: no success, and no `cancelled`, which sends nothing. */
export type ProblemCode =
  | Exclude<OutcomeCode, "ok" | "ok_empty" | "ok_degraded" | "cancelled">
  | keyof typeof ServerConditions;

export function problemEntry(code: ProblemCode): CatalogEntry {
  return code in ServerConditions
    ? ServerConditions[code as keyof typeof ServerConditions]
    : Outcomes[code as OutcomeCode];
}
