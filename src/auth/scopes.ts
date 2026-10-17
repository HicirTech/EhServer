/** What a token may do (ADR-0006; api/openapi.yaml Scope). */
export const Scopes = ["read", "write", "jobs", "admin"] as const;

export type Scope = (typeof Scopes)[number];

/** `admin` grants every scope. */
export function grants(held: readonly Scope[], needed: Scope): boolean {
  return held.includes("admin") || held.includes(needed);
}
