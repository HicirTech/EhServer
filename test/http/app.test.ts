/**
 * The HTTP application: routing, bearer tokens and scopes, problem responses and the headers every
 * response carries.
 */
import { describe, expect, test } from "bun:test";

import type { Principal } from "../../src/auth/api-tokens";
import { createApp } from "../../src/http/app";
import { problemResponse } from "../../src/http/problem";
import type { Route } from "../../src/http/router";
import { problemFindings } from "../support/contract";

const RequestId = "req_test";

const Reader: Principal = { tokenId: "tok_reader", userId: "usr_reader", scopes: ["read"] };
const Admin: Principal = { tokenId: "tok_admin", userId: "usr_admin", scopes: ["admin"] };
const Callers = new Map([
  ["ehs_reader", Reader],
  ["ehs_admin", Admin],
]);

function appWith(routes: readonly Route[], errors: unknown[] = []) {
  return createApp({
    routes,
    authenticate: (secret) => Callers.get(secret) ?? null,
    onError: (error, requestId) => errors.push({ error, requestId }),
    newRequestId: () => RequestId,
  });
}

const echo: Route = {
  method: "GET",
  path: "/api/v1/things/:name",
  scope: "read",
  handler: (_request, { params, timing }) =>
    Response.json({ name: timing.measure("store", () => params.name) }),
};

/** Who the handler was told called. */
const whoAmI: Route = {
  method: "GET",
  path: "/api/v1/admin/me",
  scope: "admin",
  handler: (_request, { principal }) => Response.json(principal),
};

function get(path: string, method = "GET", authorization = "Bearer ehs_reader"): Request {
  return new Request(`http://127.0.0.1${path}`, {
    method,
    headers: authorization === "" ? {} : { Authorization: authorization },
  });
}

describe("app", () => {
  test("OBS-1, OBS-2: a routed answer carries the request id and the time each part took", async () => {
    const response = await appWith([echo]).fetch(get("/api/v1/things/first%20thing"));

    expect(await response.json()).toEqual({ name: "first thing" });
    expect(response.headers.get("X-Request-Id")).toBe(RequestId);
    expect(response.headers.get("Server-Timing")).toMatch(/^store;dur=\d+\.\d, total;dur=\d+\.\d$/);
  });

  test("an unknown path is a not_found problem with the same request id", async () => {
    const response = await appWith([echo]).fetch(get("/api/v1/nothing"));

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    expect(await response.json()).toEqual({
      type: "https://github.com/HicirTech/EhServer/blob/main/docs/outcomes.md#4-codes",
      title: "Not found",
      status: 404,
      code: "not_found",
      clientAction: "give_up",
      requestId: RequestId,
    });
    expect(response.headers.get("X-Request-Id")).toBe(RequestId);
  });

  test("a known path with another method is method_not_allowed, naming the methods it takes", async () => {
    const response = await appWith([echo]).fetch(get("/api/v1/things/a", "POST"));

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
    expect(await response.json()).toMatchObject({ code: "method_not_allowed" });
  });

  test("a malformed escape in a path names no resource", async () => {
    const response = await appWith([echo]).fetch(get("/api/v1/things/%E0%A4%A"));

    expect(response.status).toBe(404);
  });

  test("a fault in a handler is an internal_error, reported with the request id", async () => {
    const errors: unknown[] = [];
    const fault = new Error("database is locked");
    const failing: Route = {
      method: "GET",
      path: "/api/v1/broken",
      scope: "read",
      handler: () => {
        throw fault;
      },
    };

    const response = await appWith([failing], errors).fetch(get("/api/v1/broken"));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "internal_error", requestId: RequestId });
    expect(errors).toEqual([{ error: fault, requestId: RequestId }]);
  });

  test("MAINT-2: the problems for an unknown path, a wrong method, a fault and a refused token match the contract", async () => {
    const failing: Route = {
      method: "GET",
      path: "/api/v1/broken",
      scope: "read",
      handler: () => {
        throw new Error("fault");
      },
    };
    const app = appWith([echo, failing, whoAmI]);

    const responses = await Promise.all([
      app.fetch(get("/api/v1/nothing")),
      app.fetch(get("/api/v1/things/a", "DELETE")),
      app.fetch(get("/api/v1/broken")),
      app.fetch(get("/api/v1/things/a", "GET", "")),
      app.fetch(get("/api/v1/admin/me")),
    ]);

    for (const response of responses) {
      expect(await problemFindings(response)).toEqual([]);
    }
  });
});

describe("bearer tokens (ADR-0006; RFC 6750)", () => {
  test("SEC-2: a request without a token is unauthorized, and its handler does not run", async () => {
    const errors: unknown[] = [];
    const failing: Route = {
      method: "GET",
      path: "/api/v1/broken",
      scope: "read",
      handler: () => {
        throw new Error("the handler ran");
      },
    };

    const response = await appWith([failing], errors).fetch(get("/api/v1/broken", "GET", ""));

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(response.headers.get("X-Request-Id")).toBe(RequestId);
    expect(await response.json()).toMatchObject({
      code: "unauthorized",
      clientAction: "user_action",
    });
    expect(errors).toEqual([]);
  });

  test.each<[name: string, authorization: string]>([
    ["another scheme", "Basic ZWhzX3JlYWRlcjo="],
    ["a scheme without a token", "Bearer"],
  ])("credentials of %s are no bearer token", async (_name, authorization) => {
    const response = await appWith([echo]).fetch(get("/api/v1/things/a", "GET", authorization));

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  test("SEC-2: a token the server does not know, or no longer knows, is unauthorized", async () => {
    const response = await appWith([echo]).fetch(get("/api/v1/things/a", "GET", "Bearer ehs_gone"));

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe('Bearer error="invalid_token"');
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
  });

  test("SEC-2: a token without the route's scope is forbidden", async () => {
    const response = await appWith([whoAmI]).fetch(get("/api/v1/admin/me"));

    expect(response.status).toBe(403);
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Bearer error="insufficient_scope", scope="admin"',
    );
    expect(await response.json()).toMatchObject({ code: "forbidden", clientAction: "user_action" });
  });

  test("admin grants every scope, and the scheme name is read in any case", async () => {
    const response = await appWith([echo]).fetch(
      get("/api/v1/things/a", "GET", "bearer ehs_admin"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: "a" });
  });

  test("the handler learns who called", async () => {
    const response = await appWith([whoAmI]).fetch(
      get("/api/v1/admin/me", "GET", "Bearer ehs_admin"),
    );

    expect(await response.json()).toEqual(Admin);
  });
});

describe("problemResponse", () => {
  test("a problem that says when to retry carries retryAfter and the Retry-After header", async () => {
    const response = problemResponse("upstream_rate_limited", RequestId, {
      detail: "slow down",
      retryAfterSeconds: 600,
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("600");
    expect(await response.json()).toMatchObject({
      code: "upstream_rate_limited",
      clientAction: "retry_after",
      retryAfter: 600,
      detail: "slow down",
    });
  });

  test("an empty detail is left out", async () => {
    const body = await problemResponse("site_error", RequestId, { detail: "" }).json();

    expect(body).not.toHaveProperty("detail");
  });
});
