/**
 * Search and list pages: the front page, searches, tags, uploaders and watched. Only which galleries
 * are listed, in order, and the paging; their metadata comes from `gdata` in batches, because JSON
 * is steadier than HTML (wiki: EhServer-Implications, section 7). That makes the parser the same
 * for every display mode the account may have set.
 */
import type { GalleryRef } from "../domain/gallery";
import { normalizeSpace, readCursor, readSearchText } from "./decoders";
import { type Document, find, findAll, parseHtml, text } from "./html";
import { readListRows, readPagerLink } from "./list-rows";
import {
  assembling,
  empty,
  isUnrecognized,
  type ParseResult,
  success,
  unrecognized,
} from "./parse-result";

export interface SearchPageReading {
  /** In page order. */
  readonly galleries: readonly GalleryRef[];
  /** Upstream gid cursors; null when the page offers no such page. */
  readonly prev: number | null;
  readonly next: number | null;
  /** Present only when the page states a number. */
  readonly total?: number;
  readonly filteredOut?: number;
}

export type SearchPageEmpty = "noHits" | "filteredOut" | "noWatchedTags";

const NoHitsText = "No hits found";
const NoWatchedTagsPrefix = "You do not have any watched tags";
const FilteredOutPrefix = "No unfiltered results in this page range.";

export function parseSearchPage(html: string): ParseResult<SearchPageReading, SearchPageEmpty> {
  const document = parseHtml(html);
  const container = find(".itg", document);
  if (container === null) {
    return readPageWithoutList(document);
  }

  const rows = readListRows(container);
  if (isUnrecognized(rows)) {
    return rows;
  }

  if (rows.galleries.length === 0) {
    return rows.messages.length === 1 && rows.messages[0]?.startsWith(FilteredOutPrefix)
      ? empty("filteredOut")
      : readPageWithoutList(document, rows.messages.join(" | "));
  }

  if (rows.messages.length > 0) {
    return unrecognized(".itg td[colspan]", rows.messages.join(" | "));
  }

  return readPaging(
    document,
    rows.galleries.map((listed) => listed.gallery),
  );
}

/** Clients only know these texts as paragraphs, not where on the page they sit. */
function readPageWithoutList(
  document: Document,
  raw = "",
): ParseResult<SearchPageReading, SearchPageEmpty> {
  const paragraphs = findAll("p", document).map((paragraph) =>
    normalizeSpace(text(paragraph) ?? ""),
  );
  if (paragraphs.includes(NoHitsText)) {
    return empty("noHits");
  }

  return paragraphs.some((paragraph) => paragraph.startsWith(NoWatchedTagsPrefix))
    ? empty("noWatchedTags")
    : unrecognized(".itg", raw);
}

function readPaging(
  document: Document,
  galleries: readonly GalleryRef[],
): ParseResult<SearchPageReading, SearchPageEmpty> {
  const reading = assembling(() => ({
    galleries,
    prev: readPagerLink(find("#uprev", document), "prev", (href) => readCursor(href, "prev")),
    next: readPagerLink(find("#unext", document), "next", (href) => readCursor(href, "next")),
    ...readSearchText(text(find("div.searchtext", document))),
  }));
  return isUnrecognized(reading) ? reading : success(reading);
}
