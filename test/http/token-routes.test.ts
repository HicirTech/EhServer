/** `/api/v1/admin/tokens` (ADR-0006; api/openapi.yaml listTokens, createToken, revokeToken). */
import { describe, expect, test } from "bun:test";

import { apiTokens, type Principal } from "../../src/auth/api-tokens";
import { createApp } from "../../src/http/app";
import { tokenRoutes } from "../../src/http/token-routes";
import { apiTokenStore } from "../../src/store/api-tokens";
import { openDatabase } from "../../src/store/database";
import { userStore } from "../../src/store/users";
import { responseFindings } from "../support/contract";

const Now = Date.parse("2026-10-17T08:00:00.000Z");
const Admin: Principal = { tokenId: "tok_admin", userId: "usr_admin", scopes: ["admin"] };

/** The token routes over a new database with the user alice, called with an admin token. */
function serving() {
  const db = openDatabase(":memory:");
  const users = userStore(db);
  const aliceId = users.create("alice", new Date(Now))?.id ?? "";
  const tokens = apiTokens(apiTokenStore(db), () => Now);
  const app = createApp({
    routes: tokenRoutes(tokens, users),
    authenticate: (secret) => (secret === "ehs_admin" ? Admin : null),
    onError: () => {},
    newRequestId: () => "req_test",
  });
  const send = (method: string, path = "", body?: unknown) =>
    app.fetch(
      new Request(`http://127.0.0.1/api/v1/admin/tokens${path}`, {
        method,
        headers: { Authorization: "Bearer ehs_admin", "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
  return { tokens, aliceId, send };
}

describe("token routes", () => {
  test("ADR-0006: a new token's secret is in the answer to its making and in no list", async () => {
    const { tokens, aliceId, send } = serving();

    const created = await send("POST", "", { userId: aliceId, name: "phone", scopes: ["read"] });
    const listed = await send("GET");

    expect(created.status).toBe(201);
    expect(await responseFindings("createToken", created)).toEqual([]);
    const { secret, ...token } = (await created.json()) as { readonly secret: string };
    expect(token).toEqual({
      id: expect.stringMatching(/^tok_/),
      userId: aliceId,
      name: "phone",
      scopes: ["read"],
      createdAt: "2026-10-17T08:00:00.000Z",
    });
    expect(tokens.authenticate(secret)).toMatchObject({ userId: aliceId, scopes: ["read"] });
    expect(await responseFindings("listTokens", listed)).toEqual([]);
    expect(await listed.json()).toEqual({ items: [token] });
  });

  test("ADR-0006: a revoked token stops working and is listed with when it was revoked", async () => {
    const { tokens, aliceId, send } = serving();
    const { token, secret } = tokens.issue({
      userId: aliceId,
      name: "phone",
      scopes: ["read"],
      expiresAt: null,
    });

    const revoked = await send("DELETE", `/${token.id}`);
    const listed = await send("GET");

    expect(revoked.status).toBe(204);
    expect(await revoked.text()).toBe("");
    expect(tokens.authenticate(secret)).toBeNull();
    expect(await listed.json()).toEqual({
      items: [expect.objectContaining({ id: token.id, revokedAt: "2026-10-17T08:00:00.000Z" })],
    });
  });

  test("a token made with an expiry shows it", async () => {
    const { aliceId, send } = serving();

    const created = await send("POST", "", {
      userId: aliceId,
      name: "laptop",
      scopes: ["read"],
      expiresAt: "2026-11-01T00:00:00.000Z",
    });

    expect(created.status).toBe(201);
    expect(await responseFindings("createToken", created)).toEqual([]);
    expect(await created.json()).toMatchObject({ expiresAt: "2026-11-01T00:00:00.000Z" });
    expect(await (await send("GET")).json()).toEqual({
      items: [expect.objectContaining({ expiresAt: "2026-11-01T00:00:00.000Z" })],
    });
  });

  test("an expiry that is not in the future is an invalid request", async () => {
    const { tokens, aliceId, send } = serving();

    const response = await send("POST", "", {
      userId: aliceId,
      name: "laptop",
      scopes: ["read"],
      expiresAt: "2026-10-17T08:00:00.000Z",
    });

    expect(response.status).toBe(400);
    expect(await responseFindings("createToken", response)).toEqual([]);
    expect(await response.json()).toMatchObject({
      code: "invalid_request",
      detail: "expiresAt is not in the future: 2026-10-17T08:00:00.000Z",
    });
    expect(tokens.list()).toEqual([]);
  });

  test("revoking a token that does not exist is not_found", async () => {
    const { send } = serving();

    const response = await send("DELETE", "/tok_unknown");

    expect(response.status).toBe(404);
    expect(await responseFindings("revokeToken", response)).toEqual([]);
    expect(await response.json()).toMatchObject({
      code: "not_found",
      detail: "no token tok_unknown",
    });
  });

  test.each<[name: string, body: Readonly<Record<string, unknown>>, detail: string]>([
    ["no scope", { name: "phone", scopes: [] }, "$.scopes: fewer than 1 items"],
    [
      "a scope the contract does not know",
      { name: "phone", scopes: ["root"] },
      "$.scopes[0]: expected one of read, write, jobs, admin, got root",
    ],
    ["an empty name", { name: "", scopes: ["read"] }, "$.name: shorter than 1"],
  ])("a body with %s is an invalid request", async (_name, fields, detail) => {
    const { tokens, aliceId, send } = serving();

    const response = await send("POST", "", { userId: aliceId, ...fields });

    expect(response.status).toBe(400);
    expect(await responseFindings("createToken", response)).toEqual([]);
    expect(await response.json()).toMatchObject({ code: "invalid_request", detail });
    expect(tokens.list()).toEqual([]);
  });

  test("a token for a user that does not exist is an invalid request", async () => {
    const { tokens, send } = serving();

    const response = await send("POST", "", {
      userId: "usr_unknown",
      name: "phone",
      scopes: ["read"],
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "invalid_request",
      detail: "userId names no user: usr_unknown",
    });
    expect(tokens.list()).toEqual([]);
  });
});
