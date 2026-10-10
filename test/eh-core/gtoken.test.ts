/** The `gtoken` API answer (nfr.md TEST-2; REL-1 and H5; wiki: API). */
import { describe, expect, test } from "bun:test";

import { gtokenJson } from "../../fixtures/eh/api";
import { parseGtoken } from "../../src/eh-core/gtoken";

const First = { gid: 9000001, number: 3, pageToken: "0a0a0a0a03" };
const Second = { gid: 9000002, number: 1, pageToken: "0b0b0b0b01" };

describe("parseGtoken", () => {
  test("TEST-2: gives the gallery token of each requested page, in request order", () => {
    const body = gtokenJson([
      { gid: 9000001, token: "a1b2c3d4e5" },
      { gid: 9000002, token: "b2c3d4e5f6" },
    ]);

    expect(parseGtoken(body, [First, Second])).toEqual({
      kind: "success",
      value: {
        items: [
          { kind: "success", value: { gid: 9000001, token: "a1b2c3d4e5" } },
          { kind: "success", value: { gid: 9000002, token: "b2c3d4e5f6" } },
        ],
      },
    });
  });

  test("TEST-2: 'File not found' fails only its own page", () => {
    const body = gtokenJson([{ error: "File not found" }, { gid: 9000002, token: "b2c3d4e5f6" }]);

    expect(parseGtoken(body, [First, Second])).toMatchObject({
      value: {
        items: [
          { kind: "failure", code: "invalid_token", message: "File not found" },
          { kind: "success" },
        ],
      },
    });
  });

  test("REL-1, H5: a token for another gallery than the page belongs to is unrecognized", () => {
    const body = gtokenJson([{ gid: 9000099, token: "a1b2c3d4e5" }]);

    expect(parseGtoken(body, [First])).toMatchObject({
      value: { items: [{ kind: "unrecognized", marker: "gtoken: tokenlist[]" }] },
    });
  });

  test("REL-1, H5: an answer with fewer items than requested pages is unrecognized", () => {
    const body = gtokenJson([{ gid: 9000001, token: "a1b2c3d4e5" }]);

    expect(parseGtoken(body, [First, Second])).toMatchObject({
      kind: "unrecognized",
      marker: "gtoken: tokenlist",
    });
  });

  test("an error for the whole request is a failure with the site's message", () => {
    expect(parseGtoken(JSON.stringify({ error: "Invalid request." }), [First])).toEqual({
      kind: "failure",
      code: "site_error",
      message: "Invalid request.",
    });
  });
});
