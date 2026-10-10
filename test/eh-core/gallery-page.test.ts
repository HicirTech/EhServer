/** The gallery page (nfr.md TEST-2: success, empty and failure fixtures; REL-1 and H5). */
import { describe, expect, test } from "bun:test";

import {
  contentWarningPageHtml,
  detailComment,
  detailPage,
  detailPageHtml,
  errorBoxPageHtml,
} from "../../fixtures/eh/detail-page";
import { type GalleryPageReading, parseGalleryPage } from "../../src/eh-core/gallery-page";
import type { FailureCode, ParseResult } from "../../src/eh-core/parse-result";

const Expected = { gid: 9000001, token: "a1b2c3d4e5" };

function reading(result: ParseResult<GalleryPageReading>): GalleryPageReading {
  if (result.kind !== "success") {
    throw new Error(`expected a reading, got ${JSON.stringify(result)}`);
  }

  return result.value;
}

describe("parseGalleryPage", () => {
  test("TEST-2: reads the gallery and keeps the viewer apart from it", () => {
    const result = reading(parseGalleryPage(detailPageHtml(), Expected));

    expect(result.gallery).toEqual({
      gid: 9000001,
      token: "a1b2c3d4e5",
      title: `[Sample Circle] Tom & Jerry's "Example" Gallery [English]`,
      titleJpn: "[サンプル] 例のギャラリー",
      category: "doujinshi",
      uploader: "sample uploader",
      posted: "2026-09-01T12:34:00Z",
      parent: { gid: 8000001, token: "f6e5d4c3b2" },
      visible: true,
      fileCount: 24,
      favoritedCount: 57,
      rating: { average: 4.12, count: 73 },
      tags: [
        { namespace: "language", name: "english" },
        { namespace: "language", name: "translated" },
        { namespace: "female", name: "sample tag" },
        { namespace: "artist", name: "example artist" },
      ],
      torrentCount: 2,
    });
    expect(result.viewer).toEqual({ apiuid: -1 });
  });

  test("TEST-2: reads the page tokens of this page of previews", () => {
    const html = detailPageHtml({
      previewStart: 21,
      previewPageTokens: ["0b0b0b0b21", "0b0b0b0b22"],
    });

    expect(reading(parseGalleryPage(html, Expected)).previews).toEqual({
      first: 21,
      last: 22,
      total: 24,
      pages: [
        { number: 21, pageToken: "0b0b0b0b21" },
        { number: 22, pageToken: "0b0b0b0b22" },
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

    expect(reading(parseGalleryPage(html, Expected)).comments).toEqual([
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

    expect(reading(parseGalleryPage(html, Expected)).gallery).toMatchObject({
      rating: { average: null, count: 0 },
      parent: null,
      titleJpn: null,
    });
  });

  test("TEST-2: the favourite count reads Never and Once", () => {
    const never = reading(parseGalleryPage(detailPageHtml({ favorited: "Never" }), Expected));
    const once = reading(parseGalleryPage(detailPageHtml({ favorited: "Once" }), Expected));

    expect([never.gallery.favoritedCount, once.gallery.favoritedCount]).toEqual([0, 1]);
  });

  type FailureCase = [message: string, code: FailureCode];

  test.each<FailureCase>([
    ["This gallery is pining for the fjords.", "gallery_removed"],
    [
      "This gallery is unavailable due to a copyright claim by Sample Rights Holder.",
      "gallery_unavailable",
    ],
    ["Key missing, or incorrect key provided.", "invalid_token"],
    ["Something else went wrong.", "site_error"],
  ])("TEST-2: the error box %p is the failure %p", (message, code) => {
    expect(parseGalleryPage(errorBoxPageHtml(message), Expected)).toEqual({
      kind: "failure",
      code,
      message,
    });
  });

  test("TEST-2: the content warning page is a failure", () => {
    expect(parseGalleryPage(contentWarningPageHtml(), Expected)).toMatchObject({
      kind: "failure",
      code: "content_warning",
    });
  });

  test("REL-1, H5: a page for another gallery than the one requested is unrecognized", () => {
    expect(parseGalleryPage(detailPageHtml(), { gid: 9000002, token: "a1b2c3d4e5" })).toEqual({
      kind: "unrecognized",
      marker: "script: var gid, token",
      raw: "9000001/a1b2c3d4e5",
    });
  });

  test("REL-1, H5: a page without its script variables is unrecognized", () => {
    const html = detailPageHtml().replace("var gid = 9000001;", "var gallery = 9000001;");

    expect(parseGalleryPage(html, Expected)).toMatchObject({ kind: "unrecognized" });
  });

  test("REL-1, H5: a missing metadata row is unrecognized", () => {
    const html = detailPageHtml().replace(">Length:<", ">Size:<");

    expect(parseGalleryPage(html, Expected)).toMatchObject({
      kind: "unrecognized",
      marker: "#gdd Length",
    });
  });

  test("REL-1, H5: fewer preview links than the page says it shows are unrecognized", () => {
    const page = detailPage();
    const html = detailPageHtml().replace(
      `Showing 1 - 3 of ${page.length}`,
      `Showing 1 - 4 of ${page.length}`,
    );

    expect(parseGalleryPage(html, Expected)).toMatchObject({
      kind: "unrecognized",
      marker: "#gdt a",
    });
  });

  test("H5: a second link in the uploader cell does not replace the uploader", () => {
    const html = detailPageHtml().replace(
      '</a></div><div id="gdd">',
      '</a> <a href="https://forums.e-hentai.org/index.php?showuser=1"><img class="ygm" /></a></div><div id="gdd">',
    );

    expect(reading(parseGalleryPage(html, Expected)).gallery.uploader).toBe("sample uploader");
  });
});
