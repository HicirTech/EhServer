import { categoryDiv } from "./category";
import { displayModeShape, type GalleryRow, galleryParts, galleryRow } from "./list-page";
import { escapeHtml, pageShell, type Site, siteBase } from "./page-shell";

export interface FavoriteFolder {
  readonly name: string;
  readonly count: number;
}

/** One gallery of a favourites list. */
export interface FavoriteRow {
  readonly gallery: GalleryRow;
  /** The folder the gallery is in, 0 to 9. */
  readonly slot: number;
  /** Empty when the gallery has no note. */
  readonly note: string;
  readonly favorited: string;
}

/** The display modes built here; Thumbnail is not. */
export type FavoritesDisplayMode = "minimal" | "compact" | "extended";

export interface FavoritesPage {
  readonly site: Site;
  readonly displayMode: FavoritesDisplayMode;
  readonly folders: readonly FavoriteFolder[];
  /** The folder shown, or null for "Show All Favorites". */
  readonly slot: number | null;
  readonly rows: readonly FavoriteRow[];
  /** The `<gid>-<time>` cursor of the "Prev" link, or null when there is no previous page. */
  readonly prevCursor: string | null;
  readonly nextCursor: string | null;
}

/** The `rgba` row background of each folder. */
const FolderColors = [
  "0,0,0",
  "240,0,0",
  "240,160,0",
  "208,208,0",
  "0,128,0",
  "144,240,64",
  "64,176,240",
  "0,0,240",
  "80,0,128",
  "224,128,224",
];
/** The folder icons are one sprite, 19 pixels a folder. */
const IconStep = 19;

export function favoriteFolders(
  counts: readonly number[] = [12, 0, 3, 0, 0, 0, 0, 0, 0, 1],
): FavoriteFolder[] {
  return counts.map((count, slot) => ({ name: `Favorites ${slot}`, count }));
}

export function favoriteRow(overrides: Partial<FavoriteRow> = {}): FavoriteRow {
  return {
    gallery: galleryRow(),
    slot: 0,
    note: "",
    favorited: "2026-09-02 08:15",
    ...overrides,
  };
}

/** Ordered by favourited time; an empty list is left out, pager and all. */
export function favoritesPageHtml(overrides: Partial<FavoritesPage> = {}): string {
  const page: FavoritesPage = {
    site: "eh",
    displayMode: "extended",
    folders: favoriteFolders(),
    slot: 0,
    rows: [favoriteRow()],
    prevCursor: null,
    nextCursor: null,
    ...overrides,
  };
  const base = siteBase(page.site);
  const folders = page.folders
    .map((folder, slot) => folderEntry(folder, slot, slot === page.slot, base))
    .join("");
  const showAll = `<div class="fp${page.slot === null ? " fps" : ""}" onclick="document.location='${base}favorites.php'" style="width:140px; padding:4px 0 0; margin:5px auto 0; text-align:center; font-weight:bold; position:relative; left:-8px">Show All Favorites</div>`;
  const list =
    page.rows.length === 0
      ? ""
      : `${favoritesNav("u", page, base)}<form id="favform" name="favform" action="" method="post"><input id="ddact" name="ddact" type="hidden" value="" />${listHtml(page, base)}</form>${favoritesNav("d", page, base)}`;
  return pageShell(
    page.site,
    `<div class="ido" style="min-width:930px"><h1 style="font-size:10pt; font-weight:bold; margin:3px; text-align:center">Favorites</h1><div class="nosel" style="font-size:8pt; position:relative; width:825px; margin:10px auto 5px">${folders}<div style="clear:both"></div>${showAll}</div>${searchForm(page.slot, base)}${list}</div>`,
  );
}

function folderEntry(folder: FavoriteFolder, slot: number, isShown: boolean, base: string): string {
  const name = escapeHtml(folder.name);
  return `<div class="fp${isShown ? " fps" : ""}" onclick="document.location='${base}favorites.php?favcat=${slot}'" style="width:160px; padding:2px 0 0; float:left"><div style="font-weight:bold; float:left; text-align:right; width:30px; height:20px; padding:2px 3px 0 0">${folder.count}</div><div class="i" style="background-image:url(https://ehgt.org/g/fav.png); background-position:0px ${-2 - IconStep * slot}px; position:relative; top:1px" title="${name}"></div><div style="float:left; text-align:left; height:20px; padding:2px 0 0 3px">${name}</div></div>`;
}

function searchForm(slot: number | null, base: string): string {
  const folder = slot === null ? "" : `<input type="hidden" name="favcat" value="${slot}" />`;
  return `<div style="width:825px; margin:10px auto 5px; text-align:center"><form action="${base}favorites.php" method="get">${folder}<div style="margin:3px auto 0; position:relative"><input type="text" name="f_search" value="" size="90" maxlength="200" placeholder="Search Keywords" /><input type="submit" value="Search" /><input type="button" value="Clear" onclick="top.location.href='${base}favorites.php'; return false" /></div></form></div>`;
}

function listHtml(page: FavoritesPage, base: string): string {
  if (page.displayMode === "extended") {
    const rows = page.rows.map((row) => extendedRow(row, page.folders, base));
    return `<table class="itg glte">${rows.join("")}</table>`;
  }

  const mode = page.displayMode;
  const shape = displayModeShape(mode);
  const header = shape.header.replace(/<\/tr>$/, '<th colspan="2">Favorited</th></tr>');
  const rows = page.rows.map((row) => listRow(row, mode, page.folders, base));
  return `${shape.open}${header}${rows.join("")}${shape.close}`;
}

/**
 * The Minimal or Compact row of a list, plus the folder's colour on the posted time, the note after
 * the title, and cells for the time favourited, which Compact splits in two, and a selection box.
 */
function listRow(
  row: FavoriteRow,
  mode: "minimal" | "compact",
  folders: readonly FavoriteFolder[],
  base: string,
): string {
  const { gid } = row.gallery;
  const cell = mode === "minimal" ? "glfm" : "glfc";
  const favorited =
    mode === "minimal" ? row.favorited : `<p>${row.favorited.split(" ").join("</p><p>")}</p>`;
  return displayModeShape(mode)
    .renderRow(row.gallery, base)
    .replace(` id="posted_${gid}"`, `${postedAttributes(row, folders)} id="posted_${gid}"`)
    .replace("</a></td>", `${noteDiv(row)}</a></td>`)
    .replace(
      /<\/tr>$/,
      `<td class="${cell} glfav">${favorited}</td><td class="${cell}" style="text-align:center; padding-left:3px">${selectBox(gid)}</td></tr>`,
    );
}

/** The extended row of a list, with the same additions in the places Extended mode puts them. */
function extendedRow(row: FavoriteRow, folders: readonly FavoriteFolder[], base: string): string {
  const { gallery } = row;
  const p = galleryParts(gallery, base);
  const posted = `<div onclick="popUp('${p.popup}',675,415)"${postedAttributes(row, folders)} id="posted_${gallery.gid}">${gallery.posted}</div>`;
  const tagTable = `<table><tr><td class="tc">misc:</td><td>${p.tags}</td></tr></table>`;
  return `<tr><td class="gl1e" style="width:250px"><div style="height:354px;width:250px"><a href="${p.gallery}">${p.image}</a></div></td><td class="gl2e"><div><div class="gl3e">${categoryDiv(gallery.category, "cn", base)}${posted}${p.stars}<div>${p.uploader}</div><div>${gallery.pages} pages</div><div class="gldown">${p.torrent}</div><div><p>Favorited:</p><p>${row.favorited}</p></div></div><a href="${p.gallery}"><div class="gl4e glname" style="min-height:259px"><div class="glink">${p.title}</div><div>${tagTable}</div>${noteDiv(row)}</div></a></div></td><td class="glfe" style="text-align:center; padding-left:8px">${selectBox(gallery.gid)}</td></tr>`;
}

function postedAttributes(row: FavoriteRow, folders: readonly FavoriteFolder[]): string {
  const folder = escapeHtml(folders[row.slot]?.name ?? "");
  return ` style="background-color:rgba(${FolderColors[row.slot]},.1)" title="${folder}"`;
}

function noteDiv({ gallery, note }: FavoriteRow): string {
  return note === ""
    ? `<div class="glfnote" style="display:none" id="favnote_${gallery.gid}"></div>`
    : `<div class="glfnote" id="favnote_${gallery.gid}">Note: ${escapeHtml(note)}</div>`;
}

function selectBox(gid: number): string {
  return `<label class="lc"><input type="checkbox" name="modifygids[]" value="${gid}" /><span></span></label>`;
}

/** Like the search pager, with the sort order above the list; "Last" pages back from `1-0`. */
function favoritesNav(position: "u" | "d", page: FavoritesPage, base: string): string {
  const folderUrl =
    page.slot === null ? `${base}favorites.php` : `${base}favorites.php?favcat=${page.slot}`;
  const separator = page.slot === null ? "?" : "&amp;";
  const link = (id: string, href: string | null, label: string) =>
    href === null
      ? `<span id="${position}${id}">${label}</span>`
      : `<a id="${position}${id}" href="${href}">${label}</a>`;
  const at = (query: string | null) => (query === null ? null : `${folderUrl}${separator}${query}`);
  const prev = at(page.prevCursor === null ? null : `prev=${page.prevCursor}`);
  const next = at(page.nextCursor === null ? null : `next=${page.nextCursor}`);
  const order =
    position === "u"
      ? `Order: <select onchange="document.location='${folderUrl}${separator}inline_set=fs_'+this.value+''"><option value="p">Published Time</option><option value="f" selected="selected">Favorited Time</option></select>`
      : "";
  return `<div class="searchnav"><div>${order}</div><div>${link("first", prev === null ? null : folderUrl, "&lt;&lt; First")}</div><div>${link("prev", prev, "&lt; Prev")}</div><div id="${position}jumpbox" class="jumpbox"><a id="${position}jump" href="javascript:enable_jump_mode('${position}')">Jump/Seek</a></div><div>${link("next", next, "Next &gt;")}</div><div>${link("last", at(next === null ? null : "prev=1-0"), "Last &gt;&gt;")}</div><div></div></div>`;
}
