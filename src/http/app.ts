/**
 * The HTTP application: routes each request and gives every response, problems included, an
 * `X-Request-Id` and a `Server-Timing` (nfr.md OBS-1, OBS-2).
 */
import { problemResponse } from "./problem";
import { matchRoute, type Route } from "./router";
import { createTiming } from "./timing";

export interface App {
  fetch(request: Request): Promise<Response>;
}

export interface AppOptions {
  readonly routes: readonly Route[];
  /** A fault in a handler; the client gets `internal_error` with the same request id. */
  readonly onError: (error: unknown, requestId: string) => void;
  readonly newRequestId?: () => string;
}

export function createApp({
  routes,
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
          response = await match.handler(request, { requestId, url, params: match.params, timing });
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
