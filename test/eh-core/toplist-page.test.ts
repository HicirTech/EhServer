/** Gallery toplists (nfr.md TEST-2: success and failure fixtures; REL-1 and H5). */
import { describe, expect, test } from "bun:test";

import { galleryRow, listPageHtml } from "../../fixtures/eh/list-page";
import { galleryToplistPageHtml, toplistRow } from "../../fixtures/eh/toplist-page";
import {
  galleryToplistRequest,
  parseGalleryToplistPage,
  type ToplistPeriod,
} from "../../src/eh-core/toplist-page";

const Rows = [
  toplistRow({
    gallery: galleryRow({ gid: 9000013, token: "0123456789" }),
    rank: 1,
    score: "1,234,567",
  }),
  toplistRow({
    gallery: galleryRow({ gid: 9000012, token: "abcdefabcd" }),
    rank: 2,
    score: "987,654",
  }),
];

describe("parseGalleryToplistPage", () => {
  test.each<[period: ToplistPeriod, code: number, name: string]>([
    ["allTime", 11, "Galleries All-Time"],
    ["pastYear", 12, "Galleries Past Year"],
    ["pastMonth", 13, "Galleries Past Month"],
    ["yesterday", 15, "Galleries Yesterday"],
  ])(
    "TEST-2: reads the ranked galleries and the paging of the %p toplist",
    (period, code, name) => {
      const html = galleryToplistPageHtml({ code, name, rows: Rows });

      expect(parseGalleryToplistPage(html, period)).toEqual({
        kind: "success",
        value: {
          entries: [
            { rank: 1, score: 1234567, gallery: { gid: 9000013, token: "0123456789" } },
            { rank: 2, score: 987654, gallery: { gid: 9000012, token: "abcdefabcd" } },
          ],
          page: 0,
          pageCount: 200,
        },
      });
    },
  );

  test("TEST-2: a later page carries the ranks on and says which page it is", () => {
    const html = galleryToplistPageHtml({
      page: 3,
      rows: [
        toplistRow({ rank: 151 }),
        toplistRow({ gallery: galleryRow({ gid: 9000002 }), rank: 152 }),
      ],
    });

    expect(parseGalleryToplistPage(html, "yesterday")).toMatchObject({
      kind: "success",
      value: { page: 3, pageCount: 200 },
    });
  });

  test("TEST-2: the last page and a toplist of one page", () => {
    const last = galleryToplistPageHtml({ page: 199, rows: [toplistRow({ rank: 9951 })] });
    const only = galleryToplistPageHtml({ pageCount: 1 });

    expect(parseGalleryToplistPage(last, "yesterday")).toMatchObject({
      value: { page: 199, pageCount: 200 },
    });
    expect(parseGalleryToplistPage(only, "yesterday")).toMatchObject({
      value: { page: 0, pageCount: 1 },
    });
  });

  test("REL-1, H5: another toplist than the one requested is unrecognized", () => {
    const html = galleryToplistPageHtml({ code: 11, name: "Galleries All-Time" });

    expect(parseGalleryToplistPage(html, "yesterday")).toEqual({
      kind: "unrecognized",
      marker: "h1.ih a[href]",
      raw: "https://e-hentai.org/toplist.php?tl=11",
    });
  });

  test("REL-1, H5: a gap in the ranks is unrecognized", () => {
    const html = galleryToplistPageHtml({
      rows: [toplistRow(), toplistRow({ gallery: galleryRow({ gid: 9000002 }), rank: 3 })],
    });

    expect(parseGalleryToplistPage(html, "yesterday")).toEqual({
      kind: "unrecognized",
      marker: "td > p: rank",
      raw: "1,3",
    });
  });

  test("REL-1, H5: a row without its rank is unrecognized", () => {
    const html = galleryToplistPageHtml().replace("<p>#1</p>", "<p>first</p>");

    expect(parseGalleryToplistPage(html, "yesterday")).toEqual({
      kind: "unrecognized",
      marker: "td > p: rank",
      raw: "first",
    });
  });

  test("REL-1, H5: a pager link to another toplist is unrecognized", () => {
    const html = galleryToplistPageHtml().replace("tl=15&amp;p=1", "tl=11&amp;p=1");

    expect(parseGalleryToplistPage(html, "yesterday")).toEqual({
      kind: "unrecognized",
      marker: "table.ptt a[href]",
      raw: "https://e-hentai.org/toplist.php?tl=11&p=1",
    });
  });

  test("REL-1, H5: a search page is not a toplist", () => {
    expect(parseGalleryToplistPage(listPageHtml(), "yesterday")).toEqual({
      kind: "unrecognized",
      marker: "h1.ih a[href]",
      raw: "",
    });
  });
});

describe("galleryToplistRequest", () => {
  test("asks for the period's toplist, the first page without p as the site links it", () => {
    expect(galleryToplistRequest("yesterday", 0)).toEqual({
      site: "eh",
      target: "/toplist.php?tl=15",
    });
    expect(galleryToplistRequest("allTime", 3)).toEqual({
      site: "eh",
      target: "/toplist.php?tl=11&p=3",
    });
  });
});
