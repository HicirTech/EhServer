/**
 * The single page `/s/<pageToken>/<gid>-<number>`: the image of one page, and the gallery's `showkey`
 * that later `showpage` calls need (wiki: Reading-Pipeline, sections 2 and 4).
 */
import type { PageRef } from "../domain/gallery";
import { readSinglePageVariables } from "./decoders";
import { attribute, find, findAll, parseHtml, text } from "./html";
import { type ImageSource, isQuotaImage, readImageSource } from "./image-source";
import {
  assembling,
  failure,
  isUnrecognized,
  need,
  type ParseResult,
  success,
} from "./parse-result";

export interface SinglePageReading extends PageRef {
  readonly showkey: string;
  readonly image: ImageSource;
}

/** `expected` is the page that was requested; a page for any other one is unrecognized. */
export function parseSinglePage(html: string, expected: PageRef): ParseResult<SinglePageReading> {
  const document = parseHtml(html);
  const image = find("#img", document);
  const imageUrl = attribute(image, "src");
  if (isQuotaImage(imageUrl)) {
    return failure("quota_exhausted", imageUrl ?? "");
  }

  const reading = assembling((): SinglePageReading => {
    const scripts = findAll("script", document).map((script) => text(script) ?? "");
    const variables = need(
      scripts.map(readSinglePageVariables).find((found) => found !== null),
      "script: var gid, startpage, startkey, showkey",
      "",
    );
    const isExpected =
      variables.gid === expected.gid &&
      variables.number === expected.number &&
      variables.pageToken === expected.pageToken;
    need(
      isExpected ? variables : null,
      "script: var gid, startpage, startkey",
      `${variables.gid}-${variables.number}/${variables.pageToken}`,
    );
    return {
      ...expected,
      showkey: variables.showkey,
      image: readImageSource(
        image,
        find("#loadfail", document),
        findAll('#i6 a[href*="/fullimg"], #i7 a[href*="/fullimg"]', document),
      ),
    };
  });
  return isUnrecognized(reading) ? reading : success(reading);
}
