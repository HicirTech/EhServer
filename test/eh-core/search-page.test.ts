/** Search and list pages (nfr.md TEST-2: success, empty and failure fixtures; REL-1 and H5). */
import { describe, expect, test } from "bun:test";

import { detailPageHtml } from "../../fixtures/eh/detail-page";
import {
  type DisplayMode,
  filteredOutPageHtml,
  galleryRow,
  listPageHtml,
  noHitsPageHtml,
  noWatchedTagsPageHtml,
} from "../../fixtures/eh/list-page";
import type { ParseResult } from "../../src/eh-core/parse-result";
import {
  parseSearchPage,
  type SearchPageEmpty,
  type SearchPageReading,
} from "../../src/eh-core/search-page";

const Rows = [
  galleryRow({ gid: 9000013, token: "0123456789" }),
  galleryRow({ gid: 9000012, token: "abcdefabcd", lazyThumbnail: true, torrents: false }),
  galleryRow({ gid: 9000011, token: "a1b2c3d4e5" }),
];

function reading(result: ParseResult<SearchPageReading, string>): SearchPageReading {
  if (result.kind !== "success") {
    throw new Error(`expected a reading, got ${JSON.stringify(result)}`);
  }

  return result.value;
}

describe("parseSearchPage", () => {
  test.each<[mode: DisplayMode]>([
    ["minimal"],
    ["minimalPlus"],
    ["compact"],
    ["extended"],
    ["thumbnail"],
  ])("TEST-2: lists the galleries in page order in %p mode", (displayMode) => {
    const html = listPageHtml({ displayMode, rows: Rows, prevGid: 9000014, nextGid: 9000011 });

    expect(reading(parseSearchPage(html))).toEqual({
      galleries: [
        { gid: 9000013, token: "0123456789" },
        { gid: 9000012, token: "abcdefabcd" },
        { gid: 9000011, token: "a1b2c3d4e5" },
      ],
      prev: 9000014,
      next: 9000011,
      total: 1234,
    });
  });

  test("TEST-2: skips the advertisement row some accounts get", () => {
    const html = listPageHtml({ rows: Rows, withAd: true });

    expect(reading(parseSearchPage(html)).galleries).toHaveLength(3);
  });

  test("TEST-2: the first page has no previous cursor and the last page no next cursor", () => {
    expect(reading(parseSearchPage(listPageHtml({ prevGid: null, nextGid: null })))).toMatchObject({
      prev: null,
      next: null,
    });
  });

  test("TEST-2: keeps the filtered-out count the page states", () => {
    const searchText =
      "Found thousands of results. Your custom filters removed 7 galleries from this page.";

    const result = reading(parseSearchPage(listPageHtml({ searchText })));

    expect(result.filteredOut).toBe(7);
    expect(result).not.toHaveProperty("total");
  });

  type EmptyCase = [name: string, html: string, reason: SearchPageEmpty];

  test.each<EmptyCase>([
    ["a search with no hits", noHitsPageHtml(), "noHits"],
    ["a page the account's filters emptied", filteredOutPageHtml(), "filteredOut"],
    ["the watched page without watched tags", noWatchedTagsPageHtml(), "noWatchedTags"],
    [
      "'No hits found' inside an empty list",
      listPageHtml({ displayMode: "thumbnail", rows: [] }).replace(
        '<div class="itg gld"></div>',
        '<div class="itg gld"><p>No hits found</p></div>',
      ),
      "noHits",
    ],
  ])("TEST-2: %p is a recognized empty result", (_name, html, reason) => {
    expect(parseSearchPage(html)).toEqual({ kind: "empty", reason });
  });

  test("REL-1, H5: an empty list that says nothing is unrecognized, not empty", () => {
    expect(parseSearchPage(listPageHtml({ rows: [] }))).toEqual({
      kind: "unrecognized",
      marker: ".itg",
      raw: "",
    });
  });

  test("REL-1, H5: a page without the list is unrecognized, not empty", () => {
    expect(parseSearchPage(detailPageHtml())).toEqual({
      kind: "unrecognized",
      marker: ".itg",
      raw: "",
    });
  });

  test("REL-1, H5: a list container of an unknown display mode is unrecognized", () => {
    const html = listPageHtml().replace('class="itg gltc"', 'class="itg gltx"');

    expect(parseSearchPage(html)).toEqual({
      kind: "unrecognized",
      marker: ".itg",
      raw: "itg gltx",
    });
  });

  test("REL-1, H5: a row that links two galleries is unrecognized", () => {
    const html = listPageHtml({ rows: Rows }).replace(
      '<div class="glink">',
      '<a href="https://e-hentai.org/g/9000099/fedcba9876/">other</a><div class="glink">',
    );

    expect(parseSearchPage(html)).toMatchObject({ kind: "unrecognized", marker: ".itg row" });
  });

  test("REL-1, H5: a list without the pager above it is unrecognized", () => {
    const html = listPageHtml({ nextGid: 9000011 }).replace('id="unext"', 'id="unext-moved"');

    expect(parseSearchPage(html)).toMatchObject({ kind: "unrecognized", marker: "#unext" });
  });

  test("REL-1, H5: a next link without a cursor is unrecognized", () => {
    const html = listPageHtml({ nextGid: 9000011 }).replace(/&amp;next=9000011/g, "");

    expect(parseSearchPage(html)).toMatchObject({ kind: "unrecognized", marker: "#unext[href]" });
  });
});
