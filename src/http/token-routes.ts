/** `/api/v1/admin/tokens` (ADR-0006): API tokens; a secret is shown once, when it is made. */
import type { ApiTokens } from "../auth/api-tokens";
import type { Scope } from "../auth/scopes";
import type { ApiToken } from "../store/api-tokens";
import type { UserStore } from "../store/users";
import { readJsonBody } from "./json-body";
import { problemResponse } from "./problem";
import type { Route } from "./router";

/** The body the createToken schema admits. */
interface TokenCreate {
  readonly userId: string;
  readonly name: string;
  readonly scopes: readonly Scope[];
  readonly expiresAt?: string;
}

export function tokenRoutes(
  tokens: ApiTokens,
  users: UserStore,
  now: () => number = Date.now,
): Route[] {
  return [
    {
      method: "GET",
      path: "/api/v1/admin/tokens",
      scope: "admin",
      handler: (_request, { timing }) =>
        Response.json({ items: timing.measure("store", () => tokens.list()).map(tokenBody) }),
    },
    {
      method: "POST",
      path: "/api/v1/admin/tokens",
      scope: "admin",
      handler: async (request, { requestId, timing }) => {
        const reading = await readJsonBody(request, "createToken");
        if (reading.kind === "invalid") {
          return problemResponse("invalid_request", requestId, { detail: reading.detail });
        }

        const { userId, name, scopes, expiresAt } = reading.body as TokenCreate;
        const expiry = expiresAt === undefined ? null : new Date(expiresAt);
        if (expiry !== null && expiry.getTime() <= now()) {
          return problemResponse("invalid_request", requestId, {
            detail: `expiresAt is not in the future: ${expiresAt}`,
          });
        }

        return timing.measure("store", () => {
          if (users.byId(userId) === null) {
            return problemResponse("invalid_request", requestId, {
              detail: `userId names no user: ${userId}`,
            });
          }

          const { token, secret } = tokens.issue({ userId, name, scopes, expiresAt: expiry });
          return Response.json({ ...tokenBody(token), secret }, { status: 201 });
        });
      },
    },
    {
      method: "DELETE",
      path: "/api/v1/admin/tokens/:id",
      scope: "admin",
      handler: (_request, { params, requestId, timing }) => {
        const id = params.id ?? "";
        const revoked = timing.measure("store", () => tokens.revoke(id));
        return revoked === null
          ? problemResponse("not_found", requestId, { detail: `no token ${id}` })
          : new Response(null, { status: 204 });
      },
    },
  ];
}

function tokenBody(token: ApiToken) {
  const { id, userId, name, scopes, createdAt, expiresAt, lastUsedAt, revokedAt } = token;
  return {
    id,
    userId,
    name,
    scopes,
    createdAt: createdAt.toISOString(),
    ...(expiresAt === null ? {} : { expiresAt: expiresAt.toISOString() }),
    ...(lastUsedAt === null ? {} : { lastUsedAt: lastUsedAt.toISOString() }),
    ...(revokedAt === null ? {} : { revokedAt: revokedAt.toISOString() }),
  };
}
