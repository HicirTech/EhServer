/** Stored users (ADR-0006). */
import { describe, expect, test } from "bun:test";

import { openDatabase } from "../../src/store/database";
import { userStore } from "../../src/store/users";

const CreatedAt = new Date("2026-10-17T08:00:00.000Z");

describe("userStore", () => {
  test("a user reads back by id and by name as it was made", () => {
    const users = userStore(openDatabase(":memory:"));

    const made = users.create("alice", CreatedAt);

    expect(made).toEqual({
      id: expect.stringMatching(/^usr_/),
      name: "alice",
      createdAt: CreatedAt,
    });
    expect(users.byId(made?.id ?? "")).toEqual(made);
    expect(users.byName("alice")).toEqual(made);
  });

  test("a name that is taken makes no second user", () => {
    const users = userStore(openDatabase(":memory:"));
    users.create("alice", CreatedAt);

    const second = users.create("alice", new Date("2026-10-18T08:00:00.000Z"));

    expect(second).toBeNull();
    expect(users.list()).toEqual([
      expect.objectContaining({ name: "alice", createdAt: CreatedAt }),
    ]);
  });

  test("users are listed by name, and one that does not exist reads as null", () => {
    const users = userStore(openDatabase(":memory:"));
    users.create("bob", CreatedAt);
    users.create("alice", new Date("2026-10-17T09:00:00.000Z"));

    expect(users.list().map((user) => user.name)).toEqual(["alice", "bob"]);
    expect(users.byId("usr_unknown")).toBeNull();
    expect(users.byName("carol")).toBeNull();
  });
});
