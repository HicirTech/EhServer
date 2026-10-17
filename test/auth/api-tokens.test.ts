/** API tokens (ADR-0006; nfr.md SEC-2): secrets, scopes, revocation and last use. */
import { describe, expect, test } from "bun:test";

import { apiTokens } from "../../src/auth/api-tokens";
import { apiTokenStore } from "../../src/store/api-tokens";
import { openDatabase } from "../../src/store/database";
import { userStore } from "../../src/store/users";

const Start = Date.parse("2026-10-17T08:00:00.000Z");

/** Tokens over a new database that has one user, on a clock the test moves. */
function tokensWithUser() {
  const db = openDatabase(":memory:");
  const userId = userStore(db).create("alice", new Date(Start))?.id ?? "";
  const clock = { now: Start };
  const store = apiTokenStore(db);
  return { db, store, userId, clock, tokens: apiTokens(store, () => clock.now) };
}

describe("apiTokens", () => {
  test("SEC-2: a new token's secret is given once; the database keeps only its SHA-256", () => {
    const { db, tokens, userId } = tokensWithUser();

    const { token, secret } = tokens.issue({
      userId,
      name: "phone",
      scopes: ["read"],
      expiresAt: null,
    });

    expect(secret).toMatch(/^ehs_[A-Za-z0-9_-]{43}$/);
    expect(token).toEqual({
      id: expect.stringMatching(/^tok_/),
      userId,
      name: "phone",
      scopes: ["read"],
      createdAt: new Date(Start),
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
    });
    const rows = db.query("SELECT * FROM api_tokens").all();
    expect(JSON.stringify(rows)).not.toContain(secret.slice("ehs_".length));
    expect(rows).toEqual([
      expect.objectContaining({
        secret_hash: new Bun.CryptoHasher("sha256").update(secret).digest("hex"),
      }),
    ]);
  });

  test("SEC-2: a secret names its token's user and scopes, one of each in a fixed order", () => {
    const { tokens, userId } = tokensWithUser();
    const { token, secret } = tokens.issue({
      userId,
      name: "phone",
      scopes: ["write", "read", "write"],
      expiresAt: null,
    });

    expect(tokens.authenticate(secret)).toEqual({
      tokenId: token.id,
      userId,
      scopes: ["read", "write"],
    });
  });

  test("SEC-2: an unknown secret names nobody, and a revoked token stops at once", () => {
    const { tokens, userId, clock } = tokensWithUser();
    const { token, secret } = tokens.issue({
      userId,
      name: "phone",
      scopes: ["read"],
      expiresAt: null,
    });
    clock.now += 1000;

    const revoked = tokens.revoke(token.id);

    expect(revoked?.revokedAt).toEqual(new Date(Start + 1000));
    expect(tokens.authenticate(secret)).toBeNull();
    expect(tokens.authenticate(`${secret}x`)).toBeNull();
    expect(tokens.revoke("tok_unknown")).toBeNull();
  });

  test("a token with an expiry works until then and names nobody from then on", () => {
    const { tokens, userId, clock } = tokensWithUser();
    const { secret } = tokens.issue({
      userId,
      name: "phone",
      scopes: ["read"],
      expiresAt: new Date(Start + 1000),
    });

    clock.now += 999;
    const before = tokens.authenticate(secret);
    clock.now += 1;
    const at = tokens.authenticate(secret);

    expect(before).toMatchObject({ userId });
    expect(at).toBeNull();
  });

  test("a token's last use is written at most once a minute", () => {
    const { tokens, store, userId, clock } = tokensWithUser();
    const { secret } = tokens.issue({ userId, name: "phone", scopes: ["read"], expiresAt: null });

    tokens.authenticate(secret);
    clock.now += 59_999;
    tokens.authenticate(secret);
    const withinTheMinute = store.list()[0]?.lastUsedAt;
    clock.now += 1;
    tokens.authenticate(secret);

    expect(withinTheMinute).toEqual(new Date(Start));
    expect(store.list()[0]?.lastUsedAt).toEqual(new Date(Start + 60_000));
  });
});
