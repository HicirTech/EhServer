/** The `gdata` API answer (nfr.md TEST-2; REL-1 and H5; per-item tolerance, wiki: EhServer-Implications 7). */
import { describe, expect, test } from "bun:test";

import { gdataEntry, gdataErrorEntry, gdataJson } from "../../fixtures/eh/api";
import { type GdataItem, type GdataReading, parseGdata } from "../../src/eh-core/gdata";
import type { ParseResult } from "../../src/eh-core/parse-result";

const First = { gid: 9000001, token: "a1b2c3d4e5" };
const Second = { gid: 9000002, token: "b2c3d4e5f6" };

function items(result: ParseResult<GdataReading>): ReadonlyMap<number, GdataItem> {
  if (result.kind !== "success") {
    throw new Error(`expected a reading, got ${JSON.stringify(result)}`);
  }

  return result.value.items;
}

describe("parseGdata", () => {
  test("TEST-2: reads every documented field of a gallery", () => {
    const body = gdataJson([gdataEntry({ parent_gid: "8000001", parent_key: "f6e5d4c3b2" })]);

    expect(items(parseGdata(body, [First])).get(First.gid)).toEqual({
      kind: "success",
      value: {
        gid: 9000001,
        token: "a1b2c3d4e5",
        title: `[Sample Circle] Tom & Jerry's "Example" Gallery [English]`,
        titleJpn: "[サンプル] 例のギャラリー",
        category: "doujinshi",
        uploader: "sample uploader",
        posted: "2026-09-01T12:24:00Z",
        fileCount: 24,
        fileSize: 13107200,
        expunged: false,
        rating: 4.46,
        torrentCount: 1,
        torrents: [
          {
            hash: "abcdefabcdefabcdefabcdefabcdefabcdefabcd",
            addedAt: "2026-09-01T13:24:00Z",
            name: "Example Gallery.zip",
            torrentSize: 2048,
            fileSize: 13000000,
          },
        ],
        tags: [
          { namespace: "language", name: "english" },
          { namespace: "female", name: "sample tag" },
          { namespace: "artist", name: "example artist" },
        ],
        lineage: { parent: { gid: 8000001, token: "f6e5d4c3b2" } },
        coverUrl:
          "https://ehgt.org/01/23/0123456789abcdef0123456789abcdef01234567-345678-1280-1810-jpg_250.jpg",
      },
    });
  });

  test("TEST-2: one bad token fails only its own gallery", () => {
    const body = gdataJson([
      gdataErrorEntry(First.gid),
      gdataEntry({ gid: Second.gid, token: Second.token }),
    ]);

    const result = items(parseGdata(body, [First, Second]));

    expect(result.get(First.gid)).toMatchObject({ kind: "failure", code: "invalid_token" });
    expect(result.get(Second.gid)).toMatchObject({ kind: "success" });
  });

  test("an empty Japanese title and an empty uploader mean there is none", () => {
    const body = gdataJson([gdataEntry({ title_jpn: "", uploader: "" })]);

    expect(items(parseGdata(body, [First])).get(First.gid)).toMatchObject({
      value: { titleJpn: null, uploader: null },
    });
  });

  test("counts given as numbers instead of strings read the same", () => {
    const entry = { ...gdataEntry(), filecount: 24, posted: 1788265440, torrentcount: 1 };

    expect(
      items(parseGdata(JSON.stringify({ gmetadata: [entry] }), [First])).get(First.gid),
    ).toMatchObject({
      value: { fileCount: 24, posted: "2026-09-01T12:24:00Z", torrentCount: 1 },
    });
  });

  test("REL-1, H5: a requested gallery missing from the answer is unrecognized", () => {
    const body = gdataJson([gdataEntry()]);

    expect(items(parseGdata(body, [First, Second])).get(Second.gid)).toEqual({
      kind: "unrecognized",
      marker: "gdata: gmetadata[gid]",
      raw: "9000002",
    });
  });

  type BadFieldCase = [name: string, overrides: Record<string, unknown>, marker: string];

  test.each<BadFieldCase>([
    ["another token", { token: "ffffffffff" }, "gdata: token"],
    ["a category outside the closed set", { category: "Private" }, "gdata: category"],
    ["a tag without a namespace", { tags: ["sample"] }, "gdata: tags"],
    ["a rating above 5", { rating: "5.5" }, "gdata: rating"],
    ["a missing file count", { filecount: undefined }, "gdata: filecount"],
  ])("REL-1, H5: an item with %p is unrecognized", (_name, overrides, marker) => {
    const entry = { ...gdataEntry(), ...overrides };

    expect(
      items(parseGdata(JSON.stringify({ gmetadata: [entry] }), [First])).get(First.gid),
    ).toMatchObject({
      kind: "unrecognized",
      marker,
    });
  });

  test("an error for the whole request is a failure with the site's message", () => {
    expect(parseGdata(JSON.stringify({ error: "Invalid request." }), [First])).toEqual({
      kind: "failure",
      code: "site_error",
      message: "Invalid request.",
    });
  });

  test("REL-1, H5: an answer that is not the expected JSON is unrecognized", () => {
    expect(parseGdata("<html>maintenance</html>", [First])).toMatchObject({
      kind: "unrecognized",
      marker: "gdata: JSON object",
    });
    expect(parseGdata(JSON.stringify({ galleries: [] }), [First])).toMatchObject({
      kind: "unrecognized",
      marker: "gdata: gmetadata",
    });
  });
});
