/** Stored API tokens (ADR-0006; nfr.md SEC-2). */
import { describe, expect, test } from "bun:test";

import { apiTokenStore, type NewApiToken } from "../../src/store/api-tokens";
import { openDatabase } from "../../src/store/database";
import { userStore } from "../../src/store/users";

const CreatedAt = new Date("2026-10-17T08:00:00.000Z");

/** A token store over a new database that has one user. */
function storeWithUser() {
  const db = openDatabase(":memory:");
  const userId = userStore(db).create("alice", CreatedAt)?.id ?? "";
  const token = (overrides: Partial<NewApiToken> = {}): NewApiToken => ({
    userId,
    name: "phone",
    scopes: ["read", "write"],
    secretHash: "a".repeat(64),
    createdAt: CreatedAt,
    expiresAt: null,
    ...overrides,
  });
  return { db, tokens: apiTokenStore(db), userId, token };
}

describe("apiTokenStore", () => {
  test("SEC-2: a token reads back by its secret's hash as it was made", () => {
    const { tokens, userId, token } = storeWithUser();

    const made = tokens.create(token());

    expect(made).toEqual({
      id: expect.stringMatching(/^tok_/),
      userId,
      name: "phone",
      scopes: ["read", "write"],
      createdAt: CreatedAt,
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
    });
    expect(tokens.bySecretHash("a".repeat(64))).toEqual(made);
    expect(tokens.bySecretHash("b".repeat(64))).toBeNull();
  });

  test("a token's expiry reads back", () => {
    const { tokens, token } = storeWithUser();
    const expiresAt = new Date("2027-01-01T00:00:00.000Z");

    tokens.create(token({ expiresAt }));

    expect(tokens.list()[0]?.expiresAt).toEqual(expiresAt);
  });

  test("tokens are listed oldest first", () => {
    const { tokens, token } = storeWithUser();
    const later = tokens.create(token({ secretHash: "b".repeat(64), createdAt: new Date(2e12) }));
    const earlier = tokens.create(token());

    expect(tokens.list()).toEqual([earlier, later]);
  });

  test("a revocation keeps its first time, and one of no token reads as null", () => {
    const { tokens, token } = storeWithUser();
    const { id } = tokens.create(token());
    const first = new Date("2026-10-17T09:00:00.000Z");

    tokens.revoke(id, first);
    const again = tokens.revoke(id, new Date("2026-10-17T10:00:00.000Z"));

    expect(again?.revokedAt).toEqual(first);
    expect(tokens.revoke("tok_unknown", first)).toBeNull();
  });

  test("a token's last use reads back", () => {
    const { tokens, token } = storeWithUser();
    const { id } = tokens.create(token());
    const usedAt = new Date("2026-10-17T09:30:00.000Z");

    tokens.markUsed(id, usedAt);

    expect(tokens.list()[0]?.lastUsedAt).toEqual(usedAt);
  });

  test("a damaged scope fails loudly instead of granting anything", () => {
    const { db, tokens, token } = storeWithUser();
    tokens.create(token());
    db.exec("UPDATE api_tokens SET scopes = 'read root'");

    expect(() => tokens.list()).toThrow("api_tokens.scopes holds an unknown scope: root");
  });
});
