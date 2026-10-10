/**
 * Search and list pages: the front page, searches, tags, uploaders and watched. Only which galleries
 * are listed, in order, and the paging; their metadata comes from `gdata` in batches, because JSON
 * is steadier than HTML (wiki: EhServer-Implications, section 7). That makes the parser the same
 * for every display mode the account may have set.
 */
import type { GalleryRef } from "../domain/gallery";
import { normalizeSpace, readCursor, readGalleryLink, readSearchText } from "./decoders";
import { attribute, type Document, type Element, find, findAll, parseHtml, text } from "./html";
import {
  assembling,
  empty,
  isUnrecognized,
  need,
  type ParseResult,
  success,
  type Unrecognized,
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

/** The class of the `.itg` container: Minimal and Minimal+, Compact, Extended, Thumbnail. */
const DisplayModeClasses = ["gltm", "gltc", "glte", "gld"];
const RowSelector = ":scope > tr, :scope > tbody > tr, :scope > div";
const RawExcerptLength = 120;

const NoHitsText = "No hits found";
const NoWatchedTagsPrefix = "You do not have any watched tags";
const FilteredOutPrefix = "No unfiltered results in this page range.";

type Row =
  | { readonly kind: "gallery"; readonly gallery: GalleryRef }
  | { readonly kind: "header" | "ad" }
  | { readonly kind: "message"; readonly text: string }
  | Unrecognized;

export function parseSearchPage(html: string): ParseResult<SearchPageReading, SearchPageEmpty> {
  const document = parseHtml(html);
  const container = find(".itg", document);
  if (container === null) {
    return readPageWithoutList(document);
  }

  const classes = (attribute(container, "class") ?? "").split(" ");
  if (!DisplayModeClasses.some((modeClass) => classes.includes(modeClass))) {
    return unrecognized(".itg", attribute(container, "class") ?? "");
  }

  const rows = findAll(RowSelector, container).map(readRow);
  const failed = rows.find(isUnrecognized);
  if (failed !== undefined) {
    return failed;
  }

  const galleries = rows.flatMap((row) => (row.kind === "gallery" ? [row.gallery] : []));
  const messages = rows.flatMap((row) => (row.kind === "message" ? [row.text] : []));
  if (galleries.length === 0) {
    return messages.length === 1 && messages[0]?.startsWith(FilteredOutPrefix)
      ? empty("filteredOut")
      : readPageWithoutList(document, messages.join(" | "));
  }

  if (messages.length > 0) {
    return unrecognized(".itg td[colspan]", messages.join(" | "));
  }

  return readPaging(document, galleries);
}

function readRow(row: Element): Row {
  if (find("th", row) !== null) {
    return { kind: "header" };
  }

  if (find("td.itd", row) !== null) {
    return { kind: "ad" };
  }

  const links = findAll('a[href*="/g/"]', row).map((link) => attribute(link, "href"));
  const galleries = links.map(readGalleryLink);
  const gids = new Set(galleries.map((gallery) => gallery?.gid));
  const gallery = galleries[0];
  if (gallery !== undefined && gallery !== null && gids.size === 1) {
    return { kind: "gallery", gallery };
  }

  const message = find("td[colspan]", row);
  if (links.length === 0 && message !== null) {
    return { kind: "message", text: normalizeSpace(text(message) ?? "") };
  }

  return unrecognized(".itg row", normalizeSpace(text(row) ?? "").slice(0, RawExcerptLength));
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

/** The pager above the list: an `<a>` carries the cursor, a `<span>` says there is no such page. */
function readPaging(
  document: Document,
  galleries: readonly GalleryRef[],
): ParseResult<SearchPageReading, SearchPageEmpty> {
  const reading = assembling(() => ({
    galleries,
    prev: readPagerLink(find("#uprev", document), "prev"),
    next: readPagerLink(find("#unext", document), "next"),
    ...readSearchText(text(find("div.searchtext", document))),
  }));
  return isUnrecognized(reading) ? reading : success(reading);
}

function readPagerLink(link: Element | null, direction: "prev" | "next"): number | null {
  const marker = `#u${direction}`;
  const entry = need(link, marker, "");
  if (entry.name === "span") {
    return null;
  }

  const href = attribute(entry, "href");
  return need(readCursor(href, direction), `${marker}[href]`, href);
}
