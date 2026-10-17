/** API tokens (ADR-0006, nfr.md SEC-2): each with its scopes and the hash of its secret. */
import type { Database } from "bun:sqlite";

import { type Scope, Scopes } from "../auth/scopes";
import { isOneOf } from "../domain/one-of";
import { readInstant } from "./instant";

export interface ApiToken {
  readonly id: string;
  readonly userId: string;
  /** Which device or app holds it. */
  readonly name: string;
  readonly scopes: readonly Scope[];
  readonly createdAt: Date;
  /** Null when it works until it is revoked. */
  readonly expiresAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
}

export interface NewApiToken {
  readonly userId: string;
  readonly name: string;
  readonly scopes: readonly Scope[];
  readonly secretHash: string;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
}

export interface ApiTokenStore {
  create(token: NewApiToken): ApiToken;
  /** Oldest first. */
  list(): ApiToken[];
  bySecretHash(secretHash: string): ApiToken | null;
  /** Null when no token has the id; revoking again keeps the first time. */
  revoke(id: string, at: Date): ApiToken | null;
  markUsed(id: string, at: Date): void;
}

interface TokenRow {
  readonly id: string;
  readonly user_id: string;
  readonly name: string;
  readonly scopes: string;
  readonly created_at: string;
  readonly expires_at: string | null;
  readonly last_used_at: string | null;
  readonly revoked_at: string | null;
}

const Columns = "id, user_id, name, scopes, created_at, expires_at, last_used_at, revoked_at";
const ScopeSeparator = " ";

export function apiTokenStore(db: Database): ApiTokenStore {
  const insertToken = db.query<
    unknown,
    [string, string, string, string, string, string, string | null]
  >(
    `INSERT INTO api_tokens (id, user_id, name, scopes, secret_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const selectAll = db.query<TokenRow, []>(
    `SELECT ${Columns} FROM api_tokens ORDER BY created_at, id`,
  );
  const selectBySecretHash = db.query<TokenRow, [string]>(
    `SELECT ${Columns} FROM api_tokens WHERE secret_hash = ?`,
  );
  const revokeToken = db.query<TokenRow, [string, string]>(
    `UPDATE api_tokens SET revoked_at = coalesce(revoked_at, ?) WHERE id = ? RETURNING ${Columns}`,
  );
  const markTokenUsed = db.query<unknown, [string, string]>(
    "UPDATE api_tokens SET last_used_at = ? WHERE id = ?",
  );

  return {
    create: ({ userId, name, scopes, secretHash, createdAt, expiresAt }) => {
      const id = `tok_${crypto.randomUUID()}`;
      insertToken.run(
        id,
        userId,
        name,
        scopes.join(ScopeSeparator),
        secretHash,
        createdAt.toISOString(),
        expiresAt?.toISOString() ?? null,
      );
      return { id, userId, name, scopes, createdAt, expiresAt, lastUsedAt: null, revokedAt: null };
    },
    list: () => selectAll.all().map(readToken),
    bySecretHash: (secretHash) => {
      const row = selectBySecretHash.get(secretHash);
      return row === null ? null : readToken(row);
    },
    revoke: (id, at) => {
      const row = revokeToken.get(at.toISOString(), id);
      return row === null ? null : readToken(row);
    },
    markUsed: (id, at) => {
      markTokenUsed.run(at.toISOString(), id);
    },
  };
}

function readToken(row: TokenRow): ApiToken {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    scopes: row.scopes.split(ScopeSeparator).map(readScope),
    createdAt: readInstant(row.created_at, "api_tokens.created_at"),
    expiresAt:
      row.expires_at === null ? null : readInstant(row.expires_at, "api_tokens.expires_at"),
    lastUsedAt:
      row.last_used_at === null ? null : readInstant(row.last_used_at, "api_tokens.last_used_at"),
    revokedAt:
      row.revoked_at === null ? null : readInstant(row.revoked_at, "api_tokens.revoked_at"),
  };
}

/** A damaged scope fails loudly rather than granting less or more than was given. */
function readScope(text: string): Scope {
  if (!isOneOf(Scopes, text)) {
    throw new Error(`api_tokens.scopes holds an unknown scope: ${text}`);
  }

  return text;
}
