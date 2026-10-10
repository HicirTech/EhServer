/**
 * The favourites page `favorites.php`: the ten folders with their names and counts, and one page of
 * the folder requested, or of all of them. Rows are read by their links, as on search pages; the
 * colour the site gives each row names its folder.
 */
import type { GalleryRef } from "../domain/gallery";
import {
  normalizeSpace,
  readFavoriteColor,
  readFavoriteFolderLink,
  readFavoritesCursor,
  readInteger,
  readNonEmpty,
  readSiteTime,
} from "./decoders";
import { attribute, type Document, type Element, find, findAll, parseHtml, text } from "./html";
import { type ListedGallery, readListRows, readPagerLink } from "./list-rows";
import { isLogOnPage } from "./log-on";
import {
  assembling,
  failure,
  isUnrecognized,
  need,
  type ParseResult,
  success,
  unrecognized,
} from "./parse-result";

export interface FavoriteFolderReading {
  readonly slot: number;
  readonly name: string;
  readonly count: number;
}

export interface FavoriteEntryReading {
  readonly gallery: GalleryRef;
  readonly slot: number;
  readonly note: string | null;
  /** Present unless the display mode is Thumbnail. */
  readonly favoritedAt?: string;
}

export interface FavoritesPageReading {
  readonly folders: readonly FavoriteFolderReading[];
  /** Empty only when the folders' own counts say 0. */
  readonly entries: readonly FavoriteEntryReading[];
  /** Upstream cursors `<gid>-<time>`; null when the page offers no such page. */
  readonly prev: string | null;
  readonly next: string | null;
}

const SlotCount = 10;
const NotePrefix = "Note: ";
const FavoritedLabel = "Favorited:";

/** `slot` is the folder requested, or null for "Show All Favorites". */
export function parseFavoritesPage(
  html: string,
  slot: number | null,
): ParseResult<FavoritesPageReading> {
  const document = parseHtml(html);
  if (isLogOnPage(document)) {
    return failure("signed_out");
  }

  const folders = assembling(() => readFolders(document, slot));
  if (isUnrecognized(folders)) {
    return folders;
  }

  const container = find(".itg", document);
  const rows = container === null ? null : readListRows(container);
  if (rows !== null && isUnrecognized(rows)) {
    return rows;
  }

  if (rows === null || rows.galleries.length === 0) {
    const count = folders
      .filter((folder) => slot === null || folder.slot === slot)
      .reduce((sum, folder) => sum + folder.count, 0);
    return count === 0
      ? success({ folders, entries: [], prev: null, next: null })
      : unrecognized(".itg", rows?.messages.join(" | ") ?? "");
  }

  if (rows.messages.length > 0) {
    return unrecognized(".itg td[colspan]", rows.messages.join(" | "));
  }

  const reading = assembling(() => ({
    folders,
    entries: rows.galleries.map((listed) => readEntry(listed, slot)),
    prev: readPagerLink(find("#uprev", document), "prev", (href) =>
      readFavoritesCursor(href, "prev"),
    ),
    next: readPagerLink(find("#unext", document), "next", (href) =>
      readFavoritesCursor(href, "next"),
    ),
  }));
  return isUnrecognized(reading) ? reading : success(reading);
}

/** Ten `.fp` entries open folders 0 to 9, "Show All" opens none, and `fps` marks the one shown. */
function readFolders(document: Document, slot: number | null): FavoriteFolderReading[] {
  const folders = findAll(".ido .fp", document).flatMap((element) => {
    const folder = readFavoriteFolderLink(attribute(element, "onclick"));
    return folder === null ? [] : [readFolder(element, folder)];
  });
  const slots = folders.map((folder) => folder.slot);
  const isComplete = slots.length === SlotCount && slots.every((folder, index) => folder === index);
  need(isComplete ? folders : null, ".fp[onclick]", slots.join(","));

  const shown = attribute(find(".ido .fp.fps", document), "onclick");
  need(readFavoriteFolderLink(shown) === slot ? shown : null, ".fp.fps[onclick]", shown);
  return folders;
}

/** The count, the folder icon and the name, in that order. */
function readFolder(element: Element, slot: number): FavoriteFolderReading {
  const parts = findAll(":scope > div", element).map((part) => normalizeSpace(text(part) ?? ""));
  return {
    slot,
    count: need(readInteger(parts[0]), ".fp > div: count", parts[0]),
    name: need(readNonEmpty(parts.at(-1)), ".fp > div: name", parts.at(-1)),
  };
}

function readEntry({ gallery, row }: ListedGallery, slot: number | null): FavoriteEntryReading {
  const posted = `#posted_${gallery.gid}`;
  const style = attribute(find(posted, row), "style");
  const color = readFavoriteColor(style);
  const folder = need(slot === null || color === slot ? color : null, `${posted}[style]`, style);
  return { gallery, slot: folder, note: readNote(row, gallery.gid), ...readFavoritedAt(row) };
}

/** Every display mode prints the note, hidden and empty when the gallery has none. */
function readNote(row: Element, gid: number): string | null {
  const marker = `#favnote_${gid}`;
  const value = normalizeSpace(text(need(find(marker, row), marker, "")) ?? "");
  if (value === "") {
    return null;
  }

  const note = value.startsWith(NotePrefix) ? readNonEmpty(value.slice(NotePrefix.length)) : null;
  return need(note, marker, value);
}

/**
 * Minimal modes print the time in `.glfav`, Compact splits it there into two paragraphs, Extended
 * prints it in the paragraph after a label, and Thumbnail not at all.
 */
function readFavoritedAt(row: Element): { favoritedAt?: string } {
  const cell = find(".glfav", row);
  const paragraphs = findAll("p", cell ?? row).map((paragraph) =>
    normalizeSpace(text(paragraph) ?? ""),
  );
  if (cell !== null) {
    const value = paragraphs.length === 0 ? text(cell) : paragraphs.join(" ");
    return { favoritedAt: need(readSiteTime(value), ".glfav", value) };
  }

  const label = paragraphs.indexOf(FavoritedLabel);
  if (label < 0) {
    return {};
  }

  const value = paragraphs[label + 1];
  return { favoritedAt: need(readSiteTime(value), `p ${FavoritedLabel}`, value) };
}
