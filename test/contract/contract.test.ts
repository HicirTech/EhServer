/** The API contract as the checker reads it (ADR-0008; nfr.md MAINT-2). */
import { describe, expect, test } from "bun:test";

import { assertKnownKeywords, type Schema } from "../../src/contract/schema";
import { ContractPath, contract } from "../support/contract";

/** Every `schema` in the contract's paths, wherever an operation declares one inline. */
function inlineSchemas(node: unknown, at: string): [string, Schema][] {
  if (typeof node !== "object" || node === null) {
    return [];
  }

  return Object.entries(node).flatMap(([key, child]) =>
    key === "schema" && typeof child === "object" && child !== null
      ? [[`${at}/schema`, child as Schema] as [string, Schema]]
      : inlineSchemas(child, `${at}/${key}`),
  );
}

describe("contract", () => {
  test("MAINT-2: the checker knows every keyword the contract uses", async () => {
    const document = Bun.YAML.parse(await Bun.file(ContractPath).text()) as { paths: unknown };
    const schemas = [...contract.schemas(), ...inlineSchemas(document.paths, "paths")];

    for (const [name, schema] of schemas) {
      expect(() => assertKnownKeywords(schema, name)).not.toThrow();
    }

    expect(schemas.length).toBeGreaterThan(50);
  });

  test("getToplist declares the toplist, the pending answer with Retry-After, and problems", () => {
    expect(contract.response("getToplist", 200)).toMatchObject({
      contentType: "application/json",
      schema: contract.resolve("#/components/schemas/Toplist"),
    });
    expect(contract.response("getToplist", 202)?.headers.get("retry-after")).toEqual({
      type: "integer",
      minimum: 1,
    });
    expect(contract.response("getToplist", 503)?.contentType).toBe("application/problem+json");
  });

  test("an operation the contract does not have fails loudly", () => {
    expect(() => contract.response("getWeather", 200)).toThrow(
      "the contract has no operation getWeather",
    );
  });
});
