/**
 * The `showpage` API answer: the image of one page, once the gallery's `showkey` is known
 * (wiki: Reading-Pipeline, section 2; API, section 2). Its HTML fragments are read like the page.
 */
import type { PageRef } from "../domain/gallery";
import { attribute, find, findAll, parseHtml } from "./html";
import { type ImageSource, isQuotaImage, readImageSource } from "./image-source";
import { asString, excerpt, type JsonObject, parseJsonObject } from "./json";
import {
  assembling,
  failure,
  isUnrecognized,
  need,
  type ParseResult,
  success,
  unrecognized,
} from "./parse-result";

export interface ShowpageReading extends PageRef {
  readonly image: ImageSource;
}

/** `expected` is the page that was requested; an answer for any other one is unrecognized. */
export function parseShowpage(body: string, expected: PageRef): ParseResult<ShowpageReading> {
  const answer = parseJsonObject(body);
  if (answer === null) {
    return unrecognized("showpage: JSON object", excerpt(body));
  }

  // An expired or wrong showkey is answered with an error; the single page gives a fresh one.
  if (typeof answer.error === "string") {
    return failure("invalid_token", answer.error);
  }

  const image = find("#img", parseHtml(asString(answer.i3) ?? ""));
  const imageUrl = attribute(image, "src");
  if (isQuotaImage(imageUrl)) {
    return failure("quota_exhausted", imageUrl ?? "");
  }

  const reading = assembling((): ShowpageReading => {
    readExpectedPage(answer, expected);
    const links = parseHtml(`${asString(answer.i6) ?? ""}${readOriginalField(answer.i7)}`);
    return {
      ...expected,
      image: readImageSource(
        image,
        find("#loadfail", links),
        findAll('a[href*="/fullimg"]', links),
      ),
    };
  });
  return isUnrecognized(reading) ? reading : success(reading);
}

/** `p` is the page number, `k` its token and `s` its path `s/<token>/<gid>-<number>`. */
function readExpectedPage(answer: JsonObject, expected: PageRef): void {
  const path = `s/${expected.pageToken}/${expected.gid}-${expected.number}`;
  need(answer.p === expected.number ? answer.p : null, "showpage: p", JSON.stringify(answer.p));
  need(answer.k === expected.pageToken ? answer.k : null, "showpage: k", JSON.stringify(answer.k));
  need(answer.s === path ? answer.s : null, "showpage: s", JSON.stringify(answer.s));
}

/** `i7` held the original link until 2023-10; now it is null and the link is in `i6`. */
function readOriginalField(value: unknown): string {
  return need(
    value === null || typeof value === "string" ? (value ?? "") : null,
    "showpage: i7",
    JSON.stringify(value),
  );
}
