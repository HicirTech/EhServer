/**
 * The `gtoken` API answer: the gallery token for a page that only its page token names, as a
 * `/s/` link does. One result per requested page, in request order (wiki: API, sections 0 and 2).
 */
import type { GalleryRef, PageRef } from "../domain/gallery";
import { readIntegerValue } from "./decoders";
import { excerpt, isJsonObject, parseJsonObject } from "./json";
import {
  type Failure,
  failure,
  type ParseResult,
  type Success,
  success,
  type Unrecognized,
  unrecognized,
} from "./parse-result";

export type GtokenItem = Success<GalleryRef> | Failure | Unrecognized;

export interface GtokenReading {
  readonly items: readonly GtokenItem[];
}

const TokenPattern = /^[0-9a-f]{10}$/;

export function parseGtoken(
  body: string,
  requested: readonly PageRef[],
): ParseResult<GtokenReading> {
  const answer = parseJsonObject(body);
  if (answer === null) {
    return unrecognized("gtoken: JSON object", excerpt(body));
  }

  if (typeof answer.error === "string") {
    return failure("site_error", answer.error);
  }

  const entries = answer.tokenlist;
  if (!Array.isArray(entries) || entries.length !== requested.length) {
    return unrecognized("gtoken: tokenlist", excerpt(body));
  }

  return success({ items: requested.map((page, index) => readItem(entries[index], page)) });
}

/** "File not found" is the documented answer for a page token that does not exist. */
function readItem(entry: unknown, page: PageRef): GtokenItem {
  if (!isJsonObject(entry)) {
    return unrecognized("gtoken: tokenlist[]", JSON.stringify(entry));
  }

  if (typeof entry.error === "string") {
    return failure("invalid_token", entry.error);
  }

  const isExpected = readIntegerValue(entry.gid) === page.gid;
  const token =
    typeof entry.token === "string" && TokenPattern.test(entry.token) ? entry.token : null;
  return isExpected && token !== null
    ? success({ gid: page.gid, token })
    : unrecognized("gtoken: tokenlist[]", JSON.stringify(entry));
}
