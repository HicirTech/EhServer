/** Token scopes (ADR-0006): the contract's, and what each grants. */
import { describe, expect, test } from "bun:test";

import { grants, Scopes } from "../../src/auth/scopes";
import { contract } from "../support/contract";

describe("scopes", () => {
  test("the scopes are the contract's Scope enum", () => {
    expect(contract.resolve("#/components/schemas/Scope").enum).toEqual([...Scopes]);
  });

  test("a token grants its own scopes only, and admin grants every scope", () => {
    expect(grants(["read"], "read")).toBe(true);
    expect(grants(["read", "jobs"], "write")).toBe(false);
    expect(grants(["read", "write", "jobs"], "admin")).toBe(false);
    expect(Scopes.filter((scope) => grants(["admin"], scope))).toEqual([...Scopes]);
  });
});
