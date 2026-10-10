/** The HTTP application: routing, problem responses and the headers every response carries. */
import { describe, expect, test } from "bun:test";

import { createApp } from "../../src/http/app";
import { problemResponse } from "../../src/http/problem";
import type { Route } from "../../src/http/router";

const RequestId = "req_test";

function appWith(routes: readonly Route[], errors: unknown[] = []) {
  return createApp({
    routes,
    onError: (error, requestId) => errors.push({ error, requestId }),
    newRequestId: () => RequestId,
  });
}

const echo: Route = {
  method: "GET",
  path: "/api/v1/things/:name",
  handler: (_request, { params, timing }) =>
    Response.json({ name: timing.measure("store", () => params.name) }),
};

function get(path: string, method = "GET"): Request {
  return new Request(`http://127.0.0.1${path}`, { method });
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
      handler: () => {
        throw fault;
      },
    };

    const response = await appWith([failing], errors).fetch(get("/api/v1/broken"));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "internal_error", requestId: RequestId });
    expect(errors).toEqual([{ error: fault, requestId: RequestId }]);
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
