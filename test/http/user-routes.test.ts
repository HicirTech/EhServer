/** `/api/v1/admin/users` (ADR-0006; api/openapi.yaml listUsers, createUser). */
import { describe, expect, test } from "bun:test";

import type { Principal } from "../../src/auth/api-tokens";
import { createApp } from "../../src/http/app";
import { userRoutes } from "../../src/http/user-routes";
import { openDatabase } from "../../src/store/database";
import { userStore } from "../../src/store/users";
import { responseFindings } from "../support/contract";

const Now = Date.parse("2026-10-17T08:00:00.000Z");
const Admin: Principal = { tokenId: "tok_admin", userId: "usr_admin", scopes: ["admin"] };

/** The user routes over a new database, called with an admin token. */
function serving() {
  const users = userStore(openDatabase(":memory:"));
  const app = createApp({
    routes: userRoutes(users, () => Now),
    authenticate: (secret) => (secret === "ehs_admin" ? Admin : null),
    onError: () => {},
    newRequestId: () => "req_test",
  });
  const send = (method: string, body?: string, contentType = "application/json") =>
    app.fetch(
      new Request("http://127.0.0.1/api/v1/admin/users", {
        method,
        headers: { Authorization: "Bearer ehs_admin", "Content-Type": contentType },
        ...(body === undefined ? {} : { body }),
      }),
    );
  return { users, send };
}

describe("user routes", () => {
  test("ADR-0006: an admin makes a user, who is then listed", async () => {
    const { send } = serving();

    const created = await send("POST", JSON.stringify({ name: "alice" }));
    const listed = await send("GET");

    expect(created.status).toBe(201);
    expect(await responseFindings("createUser", created)).toEqual([]);
    const user = await created.json();
    expect(user).toEqual({
      id: expect.stringMatching(/^usr_/),
      name: "alice",
      createdAt: "2026-10-17T08:00:00.000Z",
    });
    expect(await responseFindings("listUsers", listed)).toEqual([]);
    expect(await listed.json()).toEqual({ items: [user] });
  });

  test("a name that is taken is a conflict", async () => {
    const { send } = serving();
    await send("POST", JSON.stringify({ name: "alice" }));

    const response = await send("POST", JSON.stringify({ name: "alice" }));

    expect(response.status).toBe(409);
    expect(await responseFindings("createUser", response)).toEqual([]);
    expect(await response.json()).toMatchObject({ code: "conflict" });
  });

  test.each<[name: string, body: string, contentType: string, detail: string]>([
    [
      "a name the contract refuses",
      JSON.stringify({ name: "Alice" }),
      "application/json",
      "$.name: does not match ^[a-z0-9][a-z0-9_-]{0,31}$",
    ],
    [
      "a field the contract does not declare",
      JSON.stringify({ name: "alice", admin: true }),
      "application/json",
      "$: undeclared property admin",
    ],
    ["no name", "{}", "application/json", "$: missing required name"],
    ["a body that is not JSON", "name=alice", "application/json", "the body is not JSON"],
    [
      "another media type",
      "name=alice",
      "application/x-www-form-urlencoded",
      "the body must be application/json",
    ],
  ])("%s is an invalid request, and no user is made", async (_name, body, contentType, detail) => {
    const { send, users } = serving();

    const response = await send("POST", body, contentType);

    expect(response.status).toBe(400);
    expect(await responseFindings("createUser", response)).toEqual([]);
    expect(await response.json()).toMatchObject({ code: "invalid_request", detail });
    expect(users.list()).toEqual([]);
  });
});
