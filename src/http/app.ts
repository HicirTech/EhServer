/**
 * The HTTP application: routes each request, lets through only a caller whose bearer token grants
 * the route's scope (ADR-0006), and gives every response, problems included, an `X-Request-Id` and
 * a `Server-Timing` (nfr.md OBS-1, OBS-2).
 */
import type { Principal } from "../auth/api-tokens";
import { grants, type Scope } from "../auth/scopes";
import { problemResponse } from "./problem";
import { matchRoute, type Route } from "./router";
import { createTiming } from "./timing";

export interface App {
  fetch(request: Request): Promise<Response>;
}

/** The caller a token's secret names; null when it names none that may be used. */
export type Authenticate = (secret: string) => Principal | null;

export interface AppOptions {
  readonly routes: readonly Route[];
  readonly authenticate: Authenticate;
  /** A fault in a handler; the client gets `internal_error` with the same request id. */
  readonly onError: (error: unknown, requestId: string) => void;
  readonly newRequestId?: () => string;
}

/** RFC 6750 section 2.1; the scheme name is case-insensitive (RFC 9110 section 11.1). */
const BearerCredentials = /^Bearer +(\S+)$/i;

export function createApp({
  routes,
  authenticate,
  onError,
  newRequestId = () => `req_${crypto.randomUUID()}`,
}: AppOptions): App {
  return {
    fetch: async (request) => {
      const started = performance.now();
      const requestId = newRequestId();
      const timing = createTiming();
      const url = new URL(request.url);
      let response: Response;
      try {
        const match = matchRoute(routes, request.method, url.pathname);
        if (match.kind === "found") {
          const { route, params } = match;
          const caller = callerOf(request, route.scope, authenticate, requestId);
          response =
            caller instanceof Response
              ? caller
              : await route.handler(request, { requestId, url, params, timing, principal: caller });
        } else if (match.kind === "wrongMethod") {
          response = problemResponse("method_not_allowed", requestId, {
            headers: { Allow: match.allowed.join(", ") },
          });
        } else {
          response = problemResponse("not_found", requestId);
        }
      } catch (error) {
        onError(error, requestId);
        response = problemResponse("internal_error", requestId);
      }

      response.headers.set("X-Request-Id", requestId);
      response.headers.set("Server-Timing", timing.header(performance.now() - started));
      return response;
    },
  };
}

/** The caller, or the problem that turns the request away (RFC 6750 section 3). */
function callerOf(
  request: Request,
  scope: Scope,
  authenticate: Authenticate,
  requestId: string,
): Principal | Response {
  const secret = BearerCredentials.exec(request.headers.get("Authorization") ?? "")?.[1];
  if (secret === undefined) {
    return problemResponse("unauthorized", requestId, {
      detail: "send an API token as Authorization: Bearer <secret>",
      headers: { "WWW-Authenticate": "Bearer" },
    });
  }

  const principal = authenticate(secret);
  if (principal === null) {
    return problemResponse("unauthorized", requestId, {
      detail: "the token is unknown or revoked",
      headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' },
    });
  }

  if (!grants(principal.scopes, scope)) {
    return problemResponse("forbidden", requestId, {
      detail: `the token does not grant the ${scope} scope`,
      headers: { "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${scope}"` },
    });
  }

  return principal;
}
