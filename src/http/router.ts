/** The in-house router (ADR-0002): a route matches a method and a path; `:name` segments bind. */
import type { Timing } from "./timing";

export interface RouteContext {
  readonly requestId: string;
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;
  readonly timing: Timing;
}

export type Handler = (request: Request, context: RouteContext) => Response | Promise<Response>;

export interface Route {
  readonly method: string;
  /** Such as `/api/v1/toplists/:type`. */
  readonly path: string;
  readonly handler: Handler;
}

export type RouteMatch =
  | { readonly kind: "found"; readonly handler: Handler; readonly params: Record<string, string> }
  | { readonly kind: "wrongMethod"; readonly allowed: readonly string[] }
  | { readonly kind: "none" };

export function matchRoute(routes: readonly Route[], method: string, pathname: string): RouteMatch {
  const onPath = routes.flatMap((route) => {
    const params = matchPath(route.path, pathname);
    return params === null ? [] : [{ route, params }];
  });
  const found = onPath.find(({ route }) => route.method === method);
  if (found !== undefined) {
    return { kind: "found", handler: found.route.handler, params: found.params };
  }

  return onPath.length === 0
    ? { kind: "none" }
    : { kind: "wrongMethod", allowed: onPath.map(({ route }) => route.method) };
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const expected = pattern.split("/");
  const actual = pathname.split("/");
  if (expected.length !== actual.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (const [index, segment] of expected.entries()) {
    const value = actual[index] ?? "";
    if (segment.startsWith(":")) {
      const decoded = decodeSegment(value);
      if (decoded === null || decoded === "") {
        return null;
      }

      params[segment.slice(1)] = decoded;
    } else if (segment !== value) {
      return null;
    }
  }

  return params;
}

/** A malformed escape names no resource, so the path matches nothing. */
function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
