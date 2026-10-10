/** The favourites page (nfr.md TEST-2: success, empty and failure fixtures; REL-1 and H5). */
import { describe, expect, test } from "bun:test";

import {
  type FavoritesDisplayMode,
  favoriteFolders,
  favoriteRow,
  favoritesPageHtml,
} from "../../fixtures/eh/favorites-page";
import { galleryRow, listPageHtml } from "../../fixtures/eh/list-page";
import { logOnPageHtml } from "../../fixtures/eh/log-on-page";
import { type FavoritesPageReading, parseFavoritesPage } from "../../src/eh-core/favorites-page";
import type { ParseResult } from "../../src/eh-core/parse-result";

const Rows = [
  favoriteRow({
    gallery: galleryRow({ gid: 9000013, token: "0123456789" }),
    favorited: "2026-09-03 10:00",
  }),
  favoriteRow({
    gallery: galleryRow({ gid: 9000012, token: "abcdefabcd" }),
    note: "read later",
    favorited: "2026-09-02 09:30",
  }),
];
const Next = "9000012-1788341400";

function reading(result: ParseResult<FavoritesPageReading>): FavoritesPageReading {
  if (result.kind !== "success") {
    throw new Error(`expected a reading, got ${JSON.stringify(result)}`);
  }

  return result.value;
}

describe("parseFavoritesPage", () => {
  test.each<[mode: FavoritesDisplayMode]>([["minimal"], ["compact"], ["extended"]])(
    "TEST-2: reads the folders, the galleries of the folder shown and the paging in %p mode",
    (displayMode) => {
      const html = favoritesPageHtml({ displayMode, rows: Rows, nextCursor: Next });

      expect(reading(parseFavoritesPage(html, 0))).toEqual({
        folders: favoriteFolders().map((folder, slot) => ({ slot, ...folder })),
        entries: [
          {
            gallery: { gid: 9000013, token: "0123456789" },
            slot: 0,
            note: null,
            favoritedAt: "2026-09-03T10:00:00Z",
          },
          {
            gallery: { gid: 9000012, token: "abcdefabcd" },
            slot: 0,
            note: "read later",
            favoritedAt: "2026-09-02T09:30:00Z",
          },
        ],
        prev: null,
        next: Next,
      });
    },
  );

  test("TEST-2: a later page has a previous cursor", () => {
    const html = favoritesPageHtml({ prevCursor: "9000014-1788430000" });

    expect(reading(parseFavoritesPage(html, 0))).toMatchObject({
      prev: "9000014-1788430000",
      next: null,
    });
  });

  test("TEST-2: reads a folder by the colour the site gives its rows", () => {
    const html = favoritesPageHtml({ slot: 3, rows: [favoriteRow({ slot: 3 })] });

    expect(reading(parseFavoritesPage(html, 3)).entries.map((entry) => entry.slot)).toEqual([3]);
  });

  test("TEST-2: Show All lists the galleries of every folder", () => {
    const html = favoritesPageHtml({
      slot: null,
      rows: [
        favoriteRow(),
        favoriteRow({ gallery: galleryRow({ gid: 9000002, token: "abcdefabcd" }), slot: 9 }),
      ],
    });

    expect(reading(parseFavoritesPage(html, null)).entries.map((entry) => entry.slot)).toEqual([
      0, 9,
    ]);
  });

  test("TEST-2: a folder whose count says 0 is read with no entries", () => {
    const html = favoritesPageHtml({ slot: 1, rows: [] });

    expect(reading(parseFavoritesPage(html, 1))).toMatchObject({
      entries: [],
      prev: null,
      next: null,
    });
  });

  test("TEST-2: a page that asks to log on is the signed_out failure", () => {
    expect(parseFavoritesPage(logOnPageHtml(), 0)).toEqual({
      kind: "failure",
      code: "signed_out",
      message: "",
    });
  });

  test("REL-1, H5: an empty list in a folder that counts galleries is unrecognized", () => {
    expect(parseFavoritesPage(favoritesPageHtml({ rows: [] }), 0)).toEqual({
      kind: "unrecognized",
      marker: ".itg",
      raw: "",
    });
  });

  test("REL-1, H5: a page of another folder than the one requested is unrecognized", () => {
    const html = favoritesPageHtml({ slot: 2, rows: [favoriteRow({ slot: 2 })] });

    expect(parseFavoritesPage(html, 0)).toMatchObject({
      kind: "unrecognized",
      marker: ".fp.fps[onclick]",
    });
  });

  test("REL-1, H5: a row in the colour of another folder is unrecognized", () => {
    const html = favoritesPageHtml({ rows: [favoriteRow({ slot: 3 })] });

    expect(parseFavoritesPage(html, 0)).toMatchObject({
      kind: "unrecognized",
      marker: "#posted_9000001[style]",
    });
  });

  test("REL-1, H5: a row colour outside the palette is unrecognized, also in Show All", () => {
    const html = favoritesPageHtml({ slot: null }).replace("rgba(0,0,0,.1)", "rgba(1,2,3,.1)");

    expect(parseFavoritesPage(html, null)).toMatchObject({
      kind: "unrecognized",
      marker: "#posted_9000001[style]",
    });
  });

  test("REL-1, H5: a folder list without all ten folders is unrecognized", () => {
    const html = favoritesPageHtml({ folders: favoriteFolders([1, 0, 0]) });

    expect(parseFavoritesPage(html, 0)).toEqual({
      kind: "unrecognized",
      marker: ".fp[onclick]",
      raw: "0,1,2",
    });
  });

  test("REL-1, H5: a note without its label is unrecognized", () => {
    const html = favoritesPageHtml({ rows: [favoriteRow({ note: "read later" })] }).replace(
      ">Note: read later<",
      ">read later<",
    );

    expect(parseFavoritesPage(html, 0)).toEqual({
      kind: "unrecognized",
      marker: "#favnote_9000001",
      raw: "read later",
    });
  });

  test("REL-1, H5: a row without its note is unrecognized", () => {
    const html = favoritesPageHtml().replace(
      '<div class="glfnote" style="display:none" id="favnote_9000001"></div>',
      "",
    );

    expect(parseFavoritesPage(html, 0)).toEqual({
      kind: "unrecognized",
      marker: "#favnote_9000001",
      raw: "",
    });
  });

  test("REL-1, H5: a favourited cell that holds no time is unrecognized", () => {
    const html = favoritesPageHtml({
      displayMode: "compact",
      rows: [favoriteRow({ favorited: "some time" })],
    });

    expect(parseFavoritesPage(html, 0)).toEqual({
      kind: "unrecognized",
      marker: ".glfav",
      raw: "some time",
    });
  });

  test("REL-1, H5: an unreadable favourited time is unrecognized", () => {
    const html = favoritesPageHtml({ rows: [favoriteRow({ favorited: "yesterday" })] });

    expect(parseFavoritesPage(html, 0)).toEqual({
      kind: "unrecognized",
      marker: "p Favorited:",
      raw: "yesterday",
    });
  });

  test("REL-1, H5: a next link without a gid-and-time cursor is unrecognized", () => {
    const html = favoritesPageHtml({ nextCursor: Next }).replaceAll(Next, "9000012");

    expect(parseFavoritesPage(html, 0)).toMatchObject({
      kind: "unrecognized",
      marker: "#unext[href]",
    });
  });

  test("REL-1, H5: a search page is not a favourites page", () => {
    expect(parseFavoritesPage(listPageHtml(), 0)).toEqual({
      kind: "unrecognized",
      marker: ".fp[onclick]",
      raw: "",
    });
  });
});
