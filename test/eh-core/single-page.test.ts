/** The single page `/s/…` (nfr.md TEST-2; REL-1 and H5; wiki: Reading-Pipeline). */
import { describe, expect, test } from "bun:test";

import { singlePageHtml } from "../../fixtures/eh/single-page";
import type { ParseResult } from "../../src/eh-core/parse-result";
import { parseSinglePage, type SinglePageReading } from "../../src/eh-core/single-page";

const Page = { gid: 9000001, number: 3, pageToken: "0a0a0a0a03" };
const OriginalUrl = "https://e-hentai.org/fullimg.php?gid=9000001&page=3&key=0a1b2c3d4e5";

function reading(result: ParseResult<SinglePageReading>): SinglePageReading {
  if (result.kind !== "success") {
    throw new Error(`expected a reading, got ${JSON.stringify(result)}`);
  }

  return result.value;
}

describe("parseSinglePage", () => {
  test("TEST-2: reads the image, the file it must be, the reload key and the showkey", () => {
    expect(reading(parseSinglePage(singlePageHtml(), Page))).toEqual({
      ...Page,
      showkey: "s4mpl3k3y0a",
      image: {
        url: "http://198.51.100.7:2688/h/0123456789abcdef0123456789abcdef01234567-345678-1280-1810-jpg/keystamp=1788265440-0a1b2c3d4e;fileindex=1234567;xres=1280/sample_003.jpg",
        file: {
          sha1: "0123456789abcdef0123456789abcdef01234567",
          size: 345678,
          width: 1280,
          height: 1810,
          format: "jpg",
        },
        reloadKey: "12345-678901",
        originalUrl: OriginalUrl,
      },
    });
  });

  test("TEST-2: finds the original link where pages before 2023-10 put it", () => {
    const result = reading(parseSinglePage(singlePageHtml({ originalIn: "i7" }), Page));

    expect(result.image.originalUrl).toBe(OriginalUrl);
  });

  test("TEST-2: a page that offers no original has none", () => {
    expect(
      reading(parseSinglePage(singlePageHtml({ originalIn: null }), Page)).image.originalUrl,
    ).toBeNull();
  });

  test("TEST-2: the 509 image is the quota failure", () => {
    const html = singlePageHtml({ imageUrl: "https://ehgt.org/g/509.gif" });

    expect(parseSinglePage(html, Page)).toEqual({
      kind: "failure",
      code: "quota_exhausted",
      message: "https://ehgt.org/g/509.gif",
    });
  });

  test("REL-1, H5: a page for another page than the one requested is unrecognized", () => {
    expect(parseSinglePage(singlePageHtml({ number: 4 }), Page)).toMatchObject({
      kind: "unrecognized",
      marker: "script: var gid, startpage, startkey",
    });
  });

  test("REL-1, H5: an image address that does not name its file is unrecognized", () => {
    const html = singlePageHtml({ imageUrl: "https://images.example/sample_003.jpg" });

    expect(parseSinglePage(html, Page)).toMatchObject({
      kind: "unrecognized",
      marker: "#img[src]: file key",
    });
  });

  test("REL-1, H5: a page without the reload link is unrecognized", () => {
    const html = singlePageHtml().replace('id="loadfail"', 'id="reload"');

    expect(parseSinglePage(html, Page)).toMatchObject({
      kind: "unrecognized",
      marker: "#loadfail[onclick]",
    });
  });

  test("REL-1, H5: a page without its script variables, as the multi-page viewer has, is unrecognized", () => {
    const html = singlePageHtml().replace('var showkey="s4mpl3k3y0a";', "");

    expect(parseSinglePage(html, Page)).toMatchObject({ kind: "unrecognized" });
  });
});
