import {
  normalizeSpace,
  readCategory,
  readCursor,
  readGalleryLink,
  readNonEmpty,
  readPageCount,
  readSearchText,
  readSiteTime,
  readStars,
  readTag,
} from "./decoders";
import { assembling, need } from "./need";
import type { RawListPage, RawListRow, RawPagerLink } from "./raw";
import {
  empty,
  isUnrecognized,
  type ListItem,
  type ListParse,
  success,
  unrecognized,
} from "./readings";

const NoHitsText = "No hits found";
const FilteredOutPrefix = "No unfiltered results in this page range.";
const CompactModeClass = "gltc";

export function assembleListPage(raw: RawListPage): ListParse {
  if (raw.tableClass === undefined) {
    return normalizeSpace(raw.searchText ?? "") === NoHitsText
      ? empty("noHits")
      : unrecognized("table.itg");
  }

  if (!raw.tableClass.split(" ").includes(CompactModeClass)) {
    return unrecognized(`table.itg.${CompactModeClass}`, raw.tableClass);
  }

  const rows = raw.rows.filter((row) => !row.isHeader);
  if (rows.length === 1 && normalizeSpace(rows[0]?.message ?? "").startsWith(FilteredOutPrefix)) {
    return empty("filteredOut");
  }

  if (rows.length === 0) {
    return unrecognized("table.itg tr");
  }

  const reading = assembling(() => ({
    items: rows.map(assembleListItem),
    prev: readPagerLink(raw.prev, "prev"),
    next: readPagerLink(raw.next, "next"),
    ...readSearchText(raw.searchText),
  }));
  return isUnrecognized(reading) ? reading : success(reading);
}

function assembleListItem(row: RawListRow): ListItem {
  const link = need(readGalleryLink(row.href), "td.gl3c a[href]", row.href ?? row.message);
  return {
    ...link,
    title: need(readNonEmpty(row.title), "td.gl3c div.glink", row.title),
    category: need(readCategory(row.category), "td.gl1c div.cn", row.category),
    posted: need(readSiteTime(row.posted), `div#posted_${link.gid}`, row.posted),
    rating: need(readStars(row.ratingStyle), "td.gl2c div.ir[style]", row.ratingStyle),
    fileCount: need(readPageCount(row.pages), "td.gl4c div:nth-child(2)", row.pages),
    uploader: need(readNonEmpty(row.uploader), "td.gl4c a", row.uploader),
    tags: row.tags.map((title) => need(readTag(title), "td.gl3c div.gt[title]", title)),
    thumbnail: need(row.thumbnail, "td.gl2c div.glthumb img", row.thumbnail),
  };
}

/** An `<a>` carries the cursor; a `<span>` says there is no such page. */
function readPagerLink(link: RawPagerLink | undefined, direction: "prev" | "next"): number | null {
  const marker = `#u${direction}`;
  const entry = need(link, marker, "");
  return entry.tagName === "span"
    ? null
    : need(readCursor(entry.href, direction), `${marker}[href]`, entry.href);
}
