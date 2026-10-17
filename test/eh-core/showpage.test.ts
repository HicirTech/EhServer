/** The `showpage` API answer (nfr.md TEST-2; REL-1 and H5; wiki: Reading-Pipeline, API). */
import { describe, expect, test } from "bun:test";

import { showpageJson } from "../../fixtures/eh/api";
import type { ParseResult } from "../../src/eh-core/parse-result";
import { parseShowpage, type ShowpageReading } from "../../src/eh-core/showpage";

const Page = { gid: 9000001, number: 3, pageToken: "0a0a0a0a03" };
const OriginalUrl = "https://e-hentai.org/fullimg.php?gid=9000001&page=3&key=0a1b2c3d4e5";

function reading(result: ParseResult<ShowpageReading>): ShowpageReading {
  if (result.kind !== "success") {
    throw new Error(`expected a reading, got ${JSON.stringify(result)}`);
  }

  return result.value;
}

describe("parseShowpage", () => {
  test("TEST-2: reads the image, the file it must be and the reload key", () => {
    expect(reading(parseShowpage(showpageJson(), Page)).image).toEqual({
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
    });
  });

  test("TEST-2: finds the original link in i7, where answers before 2023-10 put it", () => {
    expect(reading(parseShowpage(showpageJson({ originalIn: "i7" }), Page)).image.originalUrl).toBe(
      OriginalUrl,
    );
  });

  test("TEST-2: an answer that offers no original has none", () => {
    expect(
      reading(parseShowpage(showpageJson({ originalIn: null }), Page)).image.originalUrl,
    ).toBeNull();
  });

  test("TEST-2: the 509 image is the quota failure", () => {
    expect(
      parseShowpage(showpageJson({ imageUrl: "https://exhentai.org/img/509.gif" }), Page),
    ).toMatchObject({
      kind: "failure",
      code: "quota_exhausted",
    });
  });

  test("TEST-2: an error answer is a key failure, so the single page is fetched for a new showkey", () => {
    expect(parseShowpage(JSON.stringify({ error: "Key mismatch" }), Page)).toEqual({
      kind: "failure",
      code: "invalid_token",
      message: "Key mismatch",
    });
  });

  test("REL-1, H5: an answer for another page than the one requested is unrecognized", () => {
    expect(parseShowpage(showpageJson({ number: 4 }), Page)).toMatchObject({
      kind: "unrecognized",
      marker: "showpage: p",
    });
  });

  test("REL-1, H5: an answer that is not the expected JSON is unrecognized", () => {
    expect(parseShowpage("<html></html>", Page)).toMatchObject({
      kind: "unrecognized",
      marker: "showpage: JSON object",
    });
  });

  test("TEST-2: reads an answer without i7, as the site sends them now", () => {
    const answer = { ...JSON.parse(showpageJson()), i7: undefined };

    expect(reading(parseShowpage(JSON.stringify(answer), Page)).image.originalUrl).toBe(
      OriginalUrl,
    );
  });

  test("REL-1, H5: an i7 that is neither text nor null is unrecognized", () => {
    const answer = { ...JSON.parse(showpageJson()), i7: 7 };

    expect(parseShowpage(JSON.stringify(answer), Page)).toMatchObject({
      kind: "unrecognized",
      marker: "showpage: i7",
    });
  });
});
