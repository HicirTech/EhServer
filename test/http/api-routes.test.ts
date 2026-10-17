/**
 * Every route EhServer answers is an operation of the contract, guarded by the scope the contract
 * names for it (ADR-0006, ADR-0008).
 */
import { describe, expect, test } from "bun:test";

import { apiTokens } from "../../src/auth/api-tokens";
import { apiRoutes } from "../../src/http/api-routes";
import { apiTokenStore } from "../../src/store/api-tokens";
import { openDatabase } from "../../src/store/database";
import { toplistSnapshotStore } from "../../src/store/toplist-snapshots";
import { userStore } from "../../src/store/users";
import { createToplistService } from "../../src/toplists/service";
import { ContractPath } from "../support/contract";

type SecurityRequirement = Readonly<Record<string, readonly string[]>>;

interface ContractDocument {
  readonly security: readonly SecurityRequirement[];
  readonly paths: Readonly<
    Record<string, Readonly<Record<string, { readonly security?: SecurityRequirement[] }>>>
  >;
}

const document = Bun.YAML.parse(await Bun.file(ContractPath).text()) as ContractDocument;

/** `/api/v1/toplists/:type` as the contract writes it: `/toplists/{type}`. */
function contractPath(routePath: string): string {
  return routePath.replace(/^\/api\/v1/, "").replaceAll(/:(\w+)/g, "{$1}");
}

const db = openDatabase(":memory:");
const routes = apiRoutes({
  toplists: createToplistService({
    store: toplistSnapshotStore(db),
    send: () => {
      throw new Error("no route is called here");
    },
    secondsPerPage: () => 1,
  }),
  users: userStore(db),
  tokens: apiTokens(apiTokenStore(db)),
});

describe("api routes", () => {
  test.each(routes.map((route) => [`${route.method} ${route.path}`, route] as const))(
    "%s is in the contract, with the scope it needs",
    (_name, route) => {
      const operation = document.paths[contractPath(route.path)]?.[route.method.toLowerCase()];

      expect(operation).toBeDefined();
      expect(operation?.security ?? document.security).toEqual([{ bearerAuth: [route.scope] }]);
    },
  );
});
