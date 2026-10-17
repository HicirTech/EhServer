/**
 * API tokens (ADR-0006, nfr.md SEC-2): a random secret, shown once and kept only as its SHA-256,
 * names the user behind a request and what the request may do.
 */
import type { ApiToken, ApiTokenStore } from "../store/api-tokens";
import { type Scope, Scopes } from "./scopes";

/** The caller, as its token names it. */
export interface Principal {
  readonly tokenId: string;
  readonly userId: string;
  readonly scopes: readonly Scope[];
}

export interface TokenRequest {
  readonly userId: string;
  readonly name: string;
  readonly scopes: readonly Scope[];
  /** Null for a token that works until it is revoked. */
  readonly expiresAt: Date | null;
}

export interface IssuedToken {
  readonly token: ApiToken;
  /** Shown only here: the store keeps its hash. */
  readonly secret: string;
}

export interface ApiTokens {
  issue(request: TokenRequest): IssuedToken;
  /** Null when the secret names no token, or a revoked or expired one. */
  authenticate(secret: string): Principal | null;
  list(): ApiToken[];
  /** Null when no token has the id. */
  revoke(id: string): ApiToken | null;
}

/** Lets secret scanners recognise an EhServer token. */
const SecretPrefix = "ehs_";
const SecretBytes = 32;
/** A busy client records its last use once a minute, not with every request. */
const LastUseStepMs = 60_000;

export function apiTokens(store: ApiTokenStore, now: () => number = Date.now): ApiTokens {
  return {
    issue: ({ userId, name, scopes, expiresAt }) => {
      const random = crypto.getRandomValues(new Uint8Array(SecretBytes));
      const secret = `${SecretPrefix}${Buffer.from(random).toString("base64url")}`;
      const token = store.create({
        userId,
        name,
        scopes: Scopes.filter((scope) => scopes.includes(scope)),
        secretHash: secretHash(secret),
        createdAt: new Date(now()),
        expiresAt,
      });
      return { token, secret };
    },
    authenticate: (secret) => {
      const token = store.bySecretHash(secretHash(secret));
      const at = now();
      if (token === null || token.revokedAt !== null || isExpired(token, at)) {
        return null;
      }

      if (token.lastUsedAt === null || at - token.lastUsedAt.getTime() >= LastUseStepMs) {
        store.markUsed(token.id, new Date(at));
      }

      return { tokenId: token.id, userId: token.userId, scopes: token.scopes };
    },
    list: () => store.list(),
    revoke: (id) => store.revoke(id, new Date(now())),
  };
}

function isExpired({ expiresAt }: ApiToken, at: number): boolean {
  return expiresAt !== null && expiresAt.getTime() <= at;
}

function secretHash(secret: string): string {
  return new Bun.CryptoHasher("sha256").update(secret).digest("hex");
}
