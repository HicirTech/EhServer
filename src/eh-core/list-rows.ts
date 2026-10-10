/**
 * The `.itg` list that search, list and favourites pages share. Each gallery row links exactly one
 * gallery in every display mode, so rows are read by their links, not by the mode's markup.
 */
import type { GalleryRef } from "../domain/gallery";
import { normalizeSpace, readGalleryLink } from "./decoders";
import { attribute, type Element, find, findAll, text } from "./html";
import { isUnrecognized, need, type Unrecognized, unrecognized } from "./parse-result";

export interface ListedGallery {
  readonly gallery: GalleryRef;
  /** The row, for pages that print more about each gallery. */
  readonly row: Element;
}

export interface ListRows {
  readonly galleries: readonly ListedGallery[];
  /** Rows that hold only a message, such as the filtered-out notice. */
  readonly messages: readonly string[];
}

/** The class of the `.itg` container: Minimal and Minimal+, Compact, Extended, Thumbnail. */
const DisplayModeClasses = ["gltm", "gltc", "glte", "gld"];
const RowSelector = ":scope > tr, :scope > tbody > tr, :scope > div";
const RawExcerptLength = 120;

type Row =
  | { readonly kind: "gallery"; readonly listed: ListedGallery }
  | { readonly kind: "header" | "ad" }
  | { readonly kind: "message"; readonly text: string };

export function readListRows(container: Element): ListRows | Unrecognized {
  const classes = (attribute(container, "class") ?? "").split(" ");
  if (!DisplayModeClasses.some((modeClass) => classes.includes(modeClass))) {
    return unrecognized(".itg", attribute(container, "class") ?? "");
  }

  const rows: Row[] = [];
  for (const element of findAll(RowSelector, container)) {
    const row = readRow(element);
    if (isUnrecognized(row)) {
      return row;
    }

    rows.push(row);
  }

  return {
    galleries: rows.flatMap((row) => (row.kind === "gallery" ? [row.listed] : [])),
    messages: rows.flatMap((row) => (row.kind === "message" ? [row.text] : [])),
  };
}

function readRow(row: Element): Row | Unrecognized {
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
    return { kind: "gallery", listed: { gallery, row } };
  }

  const message = find("td[colspan]", row);
  if (links.length === 0 && message !== null) {
    return { kind: "message", text: normalizeSpace(text(message) ?? "") };
  }

  return unrecognized(".itg row", normalizeSpace(text(row) ?? "").slice(0, RawExcerptLength));
}

/** The pager above the list: an `<a>` carries the cursor, a `<span>` says there is no such page. */
export function readPagerLink<T>(
  link: Element | null,
  direction: "prev" | "next",
  readCursor: (href: string | undefined) => T | null,
): T | null {
  const marker = `#u${direction}`;
  const entry = need(link, marker, "");
  if (entry.name === "span") {
    return null;
  }

  const href = attribute(entry, "href");
  return need(readCursor(href), `${marker}[href]`, href);
}
