/**
 * Both spike parsers run the same cases on synthetic pages (fixtures/README.md). The requirement
 * each block covers is in its name: TEST-2 asks for success, empty and failure fixtures per parser;
 * REL-1 and hazard H5 ask that anything not positively recognized is reported, never guessed.
 */
import { describe, expect, test } from "bun:test";
import { parseDocument } from "htmlparser2";

import {
  contentWarningPageHtml,
  detailComment,
  detailPage,
  detailPageHtml,
  errorBoxPageHtml,
} from "../../fixtures/eh/detail-page";
import {
  compactRow,
  filteredOutPageHtml,
  listPageHtml,
  noHitsPageHtml,
} from "../../fixtures/eh/list-page";
import { parseDetailPage as domDetail } from "./dom/detail-page";
import { find, text } from "./dom/elements";
import { parseListPage as domList } from "./dom/list-page";
import type {
  DetailFailureCode,
  DetailParse,
  DetailReading,
  ListParse,
  ListReading,
} from "./readings";
import { parseDetailPage as rewriterDetail } from "./rewriter/detail-page";
import { parseListPage as rewriterList } from "./rewriter/list-page";

interface Parsers {
  readonly name: string;
  readonly parseListPage: (html: string) => ListParse;
  readonly parseDetailPage: (html: string) => DetailParse;
}

const Implementations: Parsers[] = [
  { name: "htmlparser2", parseListPage: domList, parseDetailPage: domDetail },
  { name: "HTMLRewriter", parseListPage: rewriterList, parseDetailPage: rewriterDetail },
];

function listReading(result: ListParse): ListReading {
  if (result.kind !== "success") {
    throw new Error(`expected a list reading, got ${JSON.stringify(result)}`);
  }

  return result.value;
}

function detailReading(result: DetailParse): DetailReading {
  if (result.kind !== "success") {
    throw new Error(`expected a detail reading, got ${JSON.stringify(result)}`);
  }

  return result.value;
}

describe.each(Implementations)("$name list page", ({ parseListPage }) => {
  test("TEST-2: reads every field of a compact row", () => {
    const html = listPageHtml({
      rows: [
        compactRow({ gid: 9000011, token: "0123456789", category: "Artist CG" }),
        compactRow({ gid: 9000012, lazyThumbnail: true, ratingPosition: "0px -1px", pages: 1 }),
      ],
      prevGid: 9000010,
      nextGid: 9000012,
    });

    const reading = listReading(parseListPage(html));

    expect(reading.items).toHaveLength(2);
    expect(reading.items[0]).toEqual({
      gid: 9000011,
      token: "0123456789",
      title: `[Sample Circle] Tom & Jerry's "Example" Gallery [English]`,
      category: "artistCg",
      posted: "2026-09-01T12:34:00Z",
      rating: 3.5,
      fileCount: 24,
      uploader: "sample uploader",
      tags: [
        { namespace: "language", name: "english" },
        { namespace: "female", name: "sample tag" },
        { namespace: "artist", name: "example artist" },
      ],
      thumbnail: compactRow().thumbnail,
    });
    expect(reading.items[1]).toMatchObject({
      rating: 5,
      fileCount: 1,
      thumbnail: compactRow().thumbnail,
    });
    expect(reading).toMatchObject({ prev: 9000010, next: 9000012, total: 1234 });
  });

  test("TEST-2: the first page has no previous cursor and the last page no next cursor", () => {
    const reading = listReading(parseListPage(listPageHtml({ prevGid: null, nextGid: null })));

    expect(reading).toMatchObject({ prev: null, next: null });
  });

  test("TEST-2: a search with no hits is a recognized empty result", () => {
    expect(parseListPage(noHitsPageHtml())).toEqual({ kind: "empty", reason: "noHits" });
  });

  test("TEST-2: a page emptied by the account's filters is a recognized empty result", () => {
    expect(parseListPage(filteredOutPageHtml())).toEqual({ kind: "empty", reason: "filteredOut" });
  });

  test("REL-1, H5: a page without the gallery table is unrecognized, not empty", () => {
    expect(parseListPage(detailPageHtml())).toMatchObject({
      kind: "unrecognized",
      marker: "table.itg",
    });
  });

  test("REL-1, H5: another display mode is unrecognized", () => {
    const html = listPageHtml().replace('class="itg gltc"', 'class="itg glte"');

    expect(parseListPage(html)).toMatchObject({ kind: "unrecognized", marker: "table.itg.gltc" });
  });

  test("REL-1, H5: a category outside the closed set is unrecognized", () => {
    const html = listPageHtml({ rows: [compactRow({ category: "Private" })] });

    expect(parseListPage(html)).toEqual({
      kind: "unrecognized",
      marker: "td.gl1c div.cn",
      raw: "Private",
    });
  });

  test("REL-1, H5: a tag without a namespace is unrecognized", () => {
    const html = listPageHtml({ rows: [compactRow({ tags: [":untagged"] })] });

    expect(parseListPage(html)).toMatchObject({ kind: "unrecognized", raw: ":untagged" });
  });

  test("REL-1, H5: a row whose rating sprite is off the grid is unrecognized", () => {
    const html = listPageHtml({ rows: [compactRow({ ratingPosition: "-8px -1px" })] });

    expect(parseListPage(html)).toMatchObject({
      kind: "unrecognized",
      marker: "td.gl2c div.ir[style]",
    });
  });
});

describe.each(Implementations)("$name gallery page", ({ parseDetailPage }) => {
  test("TEST-2: reads the gallery, its tags, previews and comments", () => {
    const reading = detailReading(parseDetailPage(detailPageHtml()));

    expect(reading).toMatchObject({
      gid: 9000001,
      token: "a1b2c3d4e5",
      apiuid: -1,
      title: `[Sample Circle] Tom & Jerry's "Example" Gallery [English]`,
      titleJpn: "[サンプル] 例のギャラリー",
      category: "doujinshi",
      uploader: "sample uploader",
      posted: "2026-09-01T12:34:00Z",
      parent: { gid: 8000001, token: "f6e5d4c3b2" },
      visible: true,
      language: "English",
      fileCount: 24,
      favoritedCount: 57,
      rating: { average: 4.46, count: 189 },
      torrentCount: 2,
    });
    expect(reading.tags).toHaveLength(4);
    expect(reading.previews).toEqual({
      first: 1,
      last: 3,
      total: 24,
      pages: [
        { number: 1, pageToken: "0a0a0a0a01" },
        { number: 2, pageToken: "0a0a0a0a02" },
        { number: 3, pageToken: "0a0a0a0a03" },
      ],
    });
  });

  test("TEST-2: the uploader's comment has no score; others keep score, edit time and line breaks", () => {
    const html = detailPageHtml({
      comments: [
        detailComment({ id: 0, author: "sample uploader", bodyHtml: "Hello" }),
        detailComment({ score: "-43", edited: "27 September 2026, 10:00" }),
      ],
    });

    const comments = detailReading(parseDetailPage(html)).comments;

    expect(comments).toEqual([
      {
        commentId: 0,
        author: "sample uploader",
        isUploader: true,
        postedAt: "2026-09-26T09:15:00Z",
        editedAt: null,
        score: null,
        bodyText: "Hello",
      },
      {
        commentId: 7000001,
        author: "sample commenter",
        isUploader: false,
        postedAt: "2026-09-26T09:15:00Z",
        editedAt: "2026-09-27T10:00:00Z",
        score: -43,
        bodyText: "Nice & tidy.\nSecond line.",
      },
    ]);
  });

  test('TEST-2: "Not Yet Rated", no parent and no Japanese title are recognized absences', () => {
    const html = detailPageHtml({
      ratingAverage: null,
      ratingCount: 0,
      parent: null,
      titleJpn: "",
    });

    expect(detailReading(parseDetailPage(html))).toMatchObject({
      rating: null,
      parent: null,
      titleJpn: null,
    });
  });

  test("TEST-2: the favourite count reads Never and Once", () => {
    const never = detailReading(parseDetailPage(detailPageHtml({ favorited: "Never" })));
    const once = detailReading(parseDetailPage(detailPageHtml({ favorited: "Once" })));

    expect([never.favoritedCount, once.favoritedCount]).toEqual([0, 1]);
  });

  type FailureCase = [message: string, code: DetailFailureCode];

  test.each<FailureCase>([
    ["This gallery is pining for the fjords.", "gallery_removed"],
    [
      "This gallery is unavailable due to a copyright claim by Sample Rights Holder.",
      "gallery_unavailable",
    ],
    ["Key missing, or incorrect key provided.", "invalid_token"],
    ["Something else went wrong.", "site_error"],
  ])("TEST-2: the error box %p is the failure %p", (message, code) => {
    expect(parseDetailPage(errorBoxPageHtml(message))).toEqual({ kind: "failure", code, message });
  });

  test("TEST-2: the content warning page is a failure", () => {
    expect(parseDetailPage(contentWarningPageHtml())).toMatchObject({
      kind: "failure",
      code: "content_warning",
    });
  });

  test("REL-1, H5: a gallery page without its script variables is unrecognized", () => {
    const html = detailPageHtml().replace("var gid = 9000001;", "var gallery = 9000001;");

    expect(parseDetailPage(html)).toMatchObject({ kind: "unrecognized" });
  });

  test("REL-1, H5: a missing metadata row is unrecognized", () => {
    const html = detailPageHtml().replace(">Length:<", ">Size:<");

    expect(parseDetailPage(html)).toMatchObject({ kind: "unrecognized", marker: "#gdd Length" });
  });

  test("REL-1, H5: fewer preview links than the page says it shows are unrecognized", () => {
    const page = detailPage();
    const html = detailPageHtml().replace(
      `Showing 1 - 3 of ${page.length}`,
      `Showing 1 - 4 of ${page.length}`,
    );

    expect(parseDetailPage(html)).toMatchObject({ kind: "unrecognized", marker: "#gdt a" });
  });

  test("H5: a second link in the uploader cell does not replace the uploader", () => {
    const html = detailPageHtml().replace(
      '</a></div><div id="gdd">',
      '</a> <a href="https://forums.e-hentai.org/index.php?showuser=1"><img class="ygm" /></a></div><div id="gdd">',
    );

    expect(detailReading(parseDetailPage(html)).uploader).toBe("sample uploader");
  });
});

/** Valid HTML may omit these end tags. The two approaches disagree on where the text belongs. */
describe("H5: omitted end tags", () => {
  const cellsWithoutEndTags = '<table class="itg"><tr><td class="a">x<td class="b">y</tr></table>';

  test("htmlparser2 closes a cell when the next one opens, as browsers do", () => {
    expect(text(find("td.a", parseDocument(cellsWithoutEndTags)))).toBe("x");
  });

  test("HTMLRewriter nests the next cell inside the open one, so its text leaks into it", () => {
    let leaked = "";
    new HTMLRewriter()
      .on("td.a", {
        text(chunk) {
          leaked += chunk.text;
        },
      })
      .transform(cellsWithoutEndTags);

    expect(leaked).toBe("xy");
  });
});
