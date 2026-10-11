/** The in-house contract checker (ADR-0008; nfr.md MAINT-2). */
import { describe, expect, test } from "bun:test";

import { checkSchema, type Schema } from "../../src/contract/schema";

const Definitions: Readonly<Record<string, Schema>> = {
  "#/components/schemas/GalleryRef": {
    type: "object",
    required: ["gid", "token"],
    properties: {
      gid: { type: "integer", minimum: 1 },
      token: { type: "string", pattern: "^[0-9a-f]{10}$" },
    },
  },
};

function resolve(ref: string): Schema {
  const schema = Definitions[ref];
  if (schema === undefined) {
    throw new Error(`no ${ref}`);
  }

  return schema;
}

function messages(schema: Schema, value: unknown): string[] {
  return checkSchema(schema, value, resolve).map(({ path, message }) => `${path}: ${message}`);
}

describe("checkSchema", () => {
  test("a value of another type is a finding, and null passes only where the type allows it", () => {
    expect(messages({ type: ["string", "null"] }, null)).toEqual([]);
    expect(messages({ type: ["string", "null"] }, 3)).toEqual([
      "$: expected string or null, got number",
    ]);
    expect(messages({ type: "integer" }, 1.5)).toEqual(["$: expected integer, got number"]);
    expect(messages({ type: "number" }, 1)).toEqual([]);
  });

  test("objects are closed: a missing required field and an undeclared one are findings", () => {
    const schema = { type: "object", required: ["a"], properties: { a: { type: "string" } } };

    expect(messages(schema, {})).toEqual(["$: missing required a"]);
    expect(messages(schema, { a: "x", leaked: 1 })).toEqual(["$: undeclared property leaked"]);
  });

  test("a finding names where in the value it is", () => {
    const schema = {
      type: "object",
      properties: {
        entries: { type: "array", items: { $ref: "#/components/schemas/GalleryRef" } },
      },
    };

    expect(
      messages(schema, {
        entries: [
          { gid: 1, token: "a1b2c3d4e5" },
          { gid: 2, token: "nope" },
        ],
      }),
    ).toEqual(["$.entries[1].token: does not match ^[0-9a-f]{10}$"]);
  });

  test("a reference is checked by the schema it names, which also closes the object once", () => {
    const ref = { $ref: "#/components/schemas/GalleryRef" };

    expect(messages(ref, { gid: 1, token: "a1b2c3d4e5" })).toEqual([]);
    expect(messages(ref, { gid: 0, token: "a1b2c3d4e5", extra: true })).toEqual([
      "$.gid: below the minimum 1",
      "$: undeclared property extra",
    ]);
  });

  test("allOf declares the properties of every branch, and closes the object over all of them", () => {
    const schema = {
      allOf: [
        { $ref: "#/components/schemas/GalleryRef" },
        { type: "object", properties: { title: { type: "string" } } },
      ],
    };

    expect(messages(schema, { gid: 1, token: "a1b2c3d4e5", title: "t" })).toEqual([]);
    expect(messages(schema, { gid: 1, token: "a1b2c3d4e5", apikey: "k" })).toEqual([
      "$: undeclared property apikey",
    ]);
  });

  test("oneOf takes exactly one of its schemas", () => {
    const nullable = { oneOf: [{ $ref: "#/components/schemas/GalleryRef" }, { type: "null" }] };

    expect(messages(nullable, null)).toEqual([]);
    expect(messages(nullable, { gid: 1, token: "a1b2c3d4e5" })).toEqual([]);
    expect(messages(nullable, "a gallery")).toEqual(["$: matches 0 of the 2 oneOf schemas"]);
  });

  test("enum, lengths, bounds, multiples and item counts", () => {
    expect(messages({ type: "string", enum: ["eh", "ex"] }, "fx")).toEqual([
      "$: expected one of eh, ex, got fx",
    ]);
    expect(messages({ type: "string", minLength: 2, maxLength: 3 }, "abcd")).toEqual([
      "$: longer than 3",
    ]);
    expect(messages({ type: "number", maximum: 5, multipleOf: 0.5 }, 5.25)).toEqual([
      "$: above the maximum 5",
      "$: not a multiple of 0.5",
    ]);
    expect(messages({ type: "array", maxItems: 1 }, [1, 2])).toEqual(["$: more than 1 items"]);
  });

  test("I6: a date-time is a UTC instant", () => {
    const instant = { type: "string", format: "date-time" };

    expect(messages(instant, "2026-10-11T08:00:00.000Z")).toEqual([]);
    expect(messages(instant, "2026-10-11T16:00:00+08:00")).toEqual([
      "$: not a UTC date-time: 2026-10-11T16:00:00+08:00",
    ]);
    expect(messages(instant, "2026-13-40T00:00:00Z")).toEqual([
      "$: not a UTC date-time: 2026-13-40T00:00:00Z",
    ]);
  });

  test("a keyword the checker does not know fails loudly instead of being skipped", () => {
    expect(() => messages({ type: "string", const: "x" }, "x")).toThrow(
      "unsupported schema keyword const at $",
    );
  });
});
