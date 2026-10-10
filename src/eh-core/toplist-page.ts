/**
 * A gallery toplist `toplist.php?tl=<code>`: one page of ranked galleries with page-number paging.
 * The heading names the toplist shown, which must be the one requested.
 */
import type { GalleryRef } from "../domain/gallery";
import { normalizeSpace, readInteger, readToplistLink } from "./decoders";
import { attribute, type Element, find, findAll, parseHtml, text } from "./html";
import { type ListedGallery, readListRows } from "./list-rows";
import {
  assembling,
  isUnrecognized,
  need,
  type ParseResult,
  success,
  unrecognized,
} from "./parse-result";

export type ToplistPeriod = "allTime" | "pastYear" | "pastMonth" | "yesterday";

export interface ToplistEntryReading {
  readonly rank: number;
  /** The points the toplist ranks by. */
  readonly score: number;
  readonly gallery: GalleryRef;
}

export interface GalleryToplistReading {
  /** In rank order. */
  readonly entries: readonly ToplistEntryReading[];
  /** Counted from 0, like the site's `p` parameter. */
  readonly page: number;
  readonly pageCount: number;
}

/** The `tl` code of each galleries toplist. */
const GalleryToplistCodes: Readonly<Record<ToplistPeriod, number>> = {
  allTime: 11,
  pastYear: 12,
  pastMonth: 13,
  yesterday: 15,
};

export function parseGalleryToplistPage(
  html: string,
  period: ToplistPeriod,
): ParseResult<GalleryToplistReading> {
  const document = parseHtml(html);
  const code = GalleryToplistCodes[period];
  const heading = attribute(findAll("h1.ih a", document).at(-1) ?? null, "href");
  if (readToplistLink(heading)?.code !== code) {
    return unrecognized("h1.ih a[href]", heading ?? "");
  }

  const container = find(".itg", document);
  const rows = container === null ? unrecognized(".itg") : readListRows(container);
  if (isUnrecognized(rows)) {
    return rows;
  }

  if (rows.galleries.length === 0 || rows.messages.length > 0) {
    return unrecognized(".itg", rows.messages.join(" | "));
  }

  const reading = assembling(() => ({
    entries: readEntries(rows.galleries),
    ...readPager(need(find("table.ptt", document), "table.ptt", ""), code),
  }));
  return isUnrecognized(reading) ? reading : success(reading);
}

/** Ranks run on down the page without a gap. */
function readEntries(rows: readonly ListedGallery[]): ToplistEntryReading[] {
  const entries = rows.map(readEntry);
  const ranks = entries.map((entry) => entry.rank);
  const first = ranks[0] ?? 0;
  need(
    ranks.every((rank, index) => rank === first + index) ? entries : null,
    "td > p: rank",
    ranks.join(","),
  );
  return entries;
}

/** The first cell holds the rank and the score: `<p>#1</p><p>1,745,699</p>`. */
function readEntry({ gallery, row }: ListedGallery): ToplistEntryReading {
  const [rank, score] = findAll(":scope > td:first-child > p", row).map((paragraph) =>
    normalizeSpace(text(paragraph) ?? ""),
  );
  return {
    rank: need(readInteger(/^#([\d,]+)$/.exec(rank ?? "")?.[1]), "td > p: rank", rank),
    score: need(readInteger(score), "td > p: score", score),
    gallery,
  };
}

/** Every link names a page of this toplist; the page shown is marked `ptds`. */
function readPager(pager: Element, code: number): { page: number; pageCount: number } {
  const pageOf = (link: Element | null, marker: string) => {
    const href = attribute(link, "href");
    const target = readToplistLink(href);
    return need(target?.code === code ? target.page : null, marker, href);
  };
  const pages = findAll("a[href]", pager).map((link) => pageOf(link, "table.ptt a[href]"));
  return {
    page: pageOf(find("td.ptds a", pager), "td.ptds a[href]"),
    pageCount: Math.max(...pages) + 1,
  };
}
