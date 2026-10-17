/** Every route EhServer answers; a test holds each to its operation in the contract. */
import type { ApiTokens } from "../auth/api-tokens";
import type { UserStore } from "../store/users";
import type { ToplistService } from "../toplists/service";
import type { Route } from "./router";
import { tokenRoutes } from "./token-routes";
import { toplistRoute } from "./toplist-route";
import { userRoutes } from "./user-routes";

export interface ApiServices {
  readonly toplists: ToplistService;
  readonly users: UserStore;
  readonly tokens: ApiTokens;
}

export function apiRoutes({ toplists, users, tokens }: ApiServices): Route[] {
  return [toplistRoute(toplists), ...userRoutes(users), ...tokenRoutes(tokens, users)];
}
