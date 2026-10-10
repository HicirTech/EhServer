import { categoryDiv } from "./category";
import { escapeHtml, pageShell, type Site, siteBase } from "./page-shell";

/** One gallery of a list, in the forms the site prints. */
export interface GalleryRow {
  readonly gid: number;
  readonly token: string;
  readonly title: string;
  readonly category: string;
  readonly posted: string;
  /** The `background-position` of the star sprite, for example `-16px -21px`. */
  readonly ratingPosition: string;
  readonly pages: number;
  readonly uploader: string;
  /** Each tag as its `title` attribute shows it: `namespace:name`. */
  readonly tags: readonly string[];
  readonly thumbnail: string;
  /** The site's lazy-loading form: a 1-pixel GIF in `src`, the real URL in `data-src`. */
  readonly lazyThumbnail: boolean;
  readonly torrents: boolean;
}

/** The account's list display setting; each mode prints the list differently. */
export type DisplayMode = "minimal" | "minimalPlus" | "compact" | "extended" | "thumbnail";

export interface ListPage {
  readonly site: Site;
  readonly displayMode: DisplayMode;
  readonly rows: readonly GalleryRow[];
  /** Puts the site's advertisement row after the first gallery, as it does for some accounts. */
  readonly withAd: boolean;
  /** The text of `div.searchtext`. */
  readonly searchText: string;
  /** The gid in the "Prev" link, or null when the page has no previous page. */
  readonly prevGid: number | null;
  /** The gid in the "Next" link, or null when the page is the last one. */
  readonly nextGid: number | null;
}

interface ModeShape {
  /** The value of the display-mode select, and the container `.itg` with its classes. */
  readonly selectValue: string;
  readonly open: string;
  readonly close: string;
  readonly header: string;
  readonly renderRow: (row: GalleryRow, base: string) => string;
}

const PixelGif = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const Query = "f_search=sample";
const AdRow = `<tr><td colspan="4" class="itd"><div style="max-width:728px; height:100px; margin:auto"><script async src="//ads.example/ad.js"></script><ins data-width="728" data-height="90"></ins></div></td></tr>`;

const MinimalHeader = `<tr><th></th><th>Published</th><th></th><th>Title</th><th></th><th class="glhide">Uploader</th></tr>`;

const DisplayModes: Readonly<Record<DisplayMode, ModeShape>> = {
  minimal: {
    selectValue: "m",
    open: `<table class="itg gltm">`,
    close: "</table>",
    header: MinimalHeader,
    renderRow: minimalRow,
  },
  minimalPlus: {
    selectValue: "p",
    open: `<table class="itg gltm">`,
    close: "</table>",
    header: MinimalHeader,
    renderRow: minimalRow,
  },
  compact: {
    selectValue: "l",
    open: `<table class="itg gltc">`,
    close: "</table>",
    header: `<tr><th></th><th>Published</th><th>Title</th><th class="glhide">Uploader</th></tr>`,
    renderRow: compactRow,
  },
  extended: {
    selectValue: "e",
    open: `<table class="itg glte">`,
    close: "</table>",
    header: "",
    renderRow: extendedRow,
  },
  thumbnail: {
    selectValue: "t",
    open: `<div class="itg gld">`,
    close: "</div>",
    header: "",
    renderRow: thumbnailRow,
  },
};

export function galleryRow(overrides: Partial<GalleryRow> = {}): GalleryRow {
  return {
    gid: 9000001,
    token: "a1b2c3d4e5",
    title: `[Sample Circle] Tom & Jerry's "Example" Gallery [English]`,
    category: "Doujinshi",
    posted: "2026-09-01 12:34",
    ratingPosition: "-16px -21px",
    pages: 24,
    uploader: "sample uploader",
    tags: ["language:english", "female:sample tag", "artist:example artist"],
    thumbnail:
      "https://ehgt.org/t/01/23/0123456789abcdef0123456789abcdef01234567-345678-1280-1810-jpg_250.jpg",
    lazyThumbnail: false,
    torrents: true,
    ...overrides,
  };
}

export function listPageHtml(overrides: Partial<ListPage> = {}): string {
  const page: ListPage = {
    site: "eh",
    displayMode: "compact",
    rows: [galleryRow()],
    withAd: false,
    searchText: "Found 1,234 results.",
    prevGid: null,
    nextGid: null,
    ...overrides,
  };
  const base = siteBase(page.site);
  const mode = DisplayModes[page.displayMode];
  const rows = page.rows.map((row) => mode.renderRow(row, base));
  if (page.withAd && mode.header !== "" && rows.length > 0) {
    rows.splice(1, 0, AdRow);
  }

  return pageShell(
    page.site,
    `<div class="ido">${searchBox(base)}<div style="position:relative; z-index:2"><div id="rangebar"></div><div class="searchtext"><p>${page.searchText}</p></div>${searchNav("u", page, base)}${mode.open}${mode.header}${rows.join("")}${mode.close}${searchNav("d", page, base)}</div></div>`,
  );
}

/** Captured before cursor paging: the table keeps its header and holds one message row. */
export function filteredOutPageHtml(site: Site = "eh"): string {
  const base = siteBase(site);
  const message = `<tr><td style="text-align:center; font-style:italic; padding:10px 0" colspan="4">No unfiltered results in this page range. You either requested an invalid page or used too aggressive filters.</td></tr>`;
  return pageShell(
    site,
    `<div class="ido">${searchBox(base)}<div style="position:relative; z-index:2"><div class="searchtext"><p>Found 1,234 results. Your custom filters removed 25 galleries from this page.</p></div><table class="itg gltc">${DisplayModes.compact.header}${message}</table></div></div>`,
  );
}

/** Unconfirmed shape: clients only know that the body contains `No hits found</p>`. */
export function noHitsPageHtml(site: Site = "eh"): string {
  const base = siteBase(site);
  return pageShell(
    site,
    `<div class="ido">${searchBox(base)}<div style="position:relative; z-index:2"><div class="searchtext"><p>No hits found</p></div></div></div>`,
  );
}

/** Unconfirmed shape: clients only know a paragraph that starts with this text. */
export function noWatchedTagsPageHtml(site: Site = "eh"): string {
  return pageShell(
    site,
    `<div class="ido"><p>You do not have any watched tags. You can add some from My Tags.</p></div>`,
  );
}

/** The parts every mode prints, in its own arrangement. */
function parts(row: GalleryRow, base: string) {
  const popup = `${base}gallerypopups.php?gid=${row.gid}&amp;t=${row.token}&amp;act=addfav`;
  const title = escapeHtml(row.title);
  const torrentsUrl = `${base}gallerytorrents.php?gid=${row.gid}&amp;t=${row.token}`;
  return {
    gallery: `${base}g/${row.gid}/${row.token}/`,
    title,
    posted: (id: string) =>
      `<div onclick="popUp('${popup}',675,415)" id="${id}_${row.gid}">${row.posted}</div>`,
    stars: `<div class="ir" style="background-position:${row.ratingPosition};opacity:1"></div>`,
    image: row.lazyThumbnail
      ? `<img style="height:354px;width:250px" alt="${title}" title="${title}" src="${PixelGif}" data-src="${row.thumbnail}" />`
      : `<img style="height:354px;width:250px" alt="${title}" title="${title}" src="${row.thumbnail}" />`,
    torrent: row.torrents
      ? `<a href="${torrentsUrl}" onclick="return popUp('${torrentsUrl}', 610, 590)" rel="nofollow"><img src="https://ehgt.org/g/t.png" alt="T" title="Show torrents" /></a>`
      : `<img src="https://ehgt.org/g/td.png" alt="T" title="No torrents available" />`,
    uploader: `<a href="${base}uploader/${encodeURIComponent(row.uploader)}">${escapeHtml(row.uploader)}</a>`,
    // The visible text drops the namespace; only the title attribute has the whole tag.
    tags: row.tags
      .map(
        (tag) =>
          `<div class="gt" title="${escapeHtml(tag)}">${escapeHtml(tag.slice(tag.indexOf(":") + 1))}</div>`,
      )
      .join(""),
  };
}

function minimalRow(row: GalleryRow, base: string): string {
  const p = parts(row, base);
  return `<tr><td class="gl1m glcat">${categoryDiv(row.category, "cs", base)}</td><td class="gl2m"><div class="glcut" id="ic${row.gid}"></div><div class="glthumb" id="it${row.gid}" style="top:-22px;height:400px"><div>${p.image}</div><div><div>${categoryDiv(row.category, "cs", base)}${p.posted("postedpop")}</div><div>${p.stars}<div>${row.pages} pages</div></div></div></div>${p.posted("posted")}</td><td class="gl6m"><div class="gldown">${p.torrent}</div></td><td class="gl3m glname"><a href="${p.gallery}"><div class="glink">${p.title}</div></a></td><td class="gl4m">${p.stars}</td><td class="gl5m glhide"><div>${p.uploader}</div></td></tr>`;
}

function compactRow(row: GalleryRow, base: string): string {
  const p = parts(row, base);
  return `<tr><td class="gl1c glcat">${categoryDiv(row.category, "cn", base)}</td><td class="gl2c"><div class="glcut" id="ic${row.gid}"></div><div class="glthumb" id="it${row.gid}" style="top:-22px;height:400px"><div>${p.image}</div><div><div>${categoryDiv(row.category, "cn", base)}${p.posted("postedpop")}</div><div>${p.stars}<div>${row.pages} pages</div></div></div></div><div>${p.posted("posted")}${p.stars}<div class="gldown">${p.torrent}</div></div></td><td class="gl3c glname" onmouseover="show_image_pane(${row.gid});preload_pane_image(0,${row.gid})" onmouseout="hide_image_pane(${row.gid})"><a href="${p.gallery}"><div class="glink">${p.title}</div><div>${p.tags}</div></a></td><td class="gl4c glhide"><div>${p.uploader}</div><div>${row.pages} pages</div></td></tr>`;
}

/** The nested tag table omits `</tr>`, as the captured page does. */
function extendedRow(row: GalleryRow, base: string): string {
  const p = parts(row, base);
  const tagTable = `<table><tr><td class="tc">misc:</td><td>${p.tags}</td></table>`;
  return `<tr><td class="gl1e" style="width:250px"><div style="height:354px;width:250px"><a href="${p.gallery}">${p.image}</a></div></td><td class="gl2e"><div><div class="gl3e">${categoryDiv(row.category, "cn", base)}${p.posted("posted")}${p.stars}<div>${p.uploader}</div><div>${row.pages} pages</div><div class="gldown">${p.torrent}</div></div><a href="${p.gallery}"><div class="gl4e glname"><div class="glink">${p.title}</div><div>${tagTable}</div></div></a></div></td></tr>`;
}

function thumbnailRow(row: GalleryRow, base: string): string {
  const p = parts(row, base);
  return `<div class="gl1t"><a href="${p.gallery}"><div class="gl4t glname">${p.title}</div></a><div class="gl3t" style="height:354px;width:250px"><a href="${p.gallery}">${p.image}</a></div><div class="gl5t"><div>${categoryDiv(row.category, "cs", base)}${p.posted("posted")}</div><div>${p.stars}<div>${row.pages} pages</div><div class="gldown">${p.torrent}</div></div></div></div>`;
}

/** The site prints the pager twice: `u` above the list, with the display-mode select, and `d` below it. */
function searchNav(position: "u" | "d", page: ListPage, base: string): string {
  const link = (id: string, cursor: string | null, label: string) =>
    cursor === null
      ? `<span id="${position}${id}">${label}</span>`
      : `<a id="${position}${id}" href="${base}?${Query}${cursor}">${label}</a>`;
  const prev = page.prevGid === null ? null : `&amp;prev=${page.prevGid}`;
  const next = page.nextGid === null ? null : `&amp;next=${page.nextGid}`;
  const select = position === "u" ? modeSelect(page.displayMode, base) : "";
  return `<div class="searchnav"><div></div><div>${link("first", prev === null ? null : "", "&lt;&lt; First")}</div><div>${link("prev", prev, "&lt; Prev")}</div><div id="${position}jumpbox" class="jumpbox"><a id="${position}jump" href="javascript:enable_jump_mode('${position}')">Jump/Seek</a></div><div>${link("next", next, "Next &gt;")}</div><div>${link("last", next === null ? null : "&amp;prev=1", "Last &gt;&gt;")}</div><div>${select}</div></div>`;
}

function modeSelect(mode: DisplayMode, base: string): string {
  const labels: Readonly<Record<DisplayMode, string>> = {
    minimal: "Minimal",
    minimalPlus: "Minimal+",
    compact: "Compact",
    extended: "Extended",
    thumbnail: "Thumbnail",
  };
  const options = (Object.keys(labels) as DisplayMode[])
    .map((option) => {
      const selected = option === mode ? ' selected="selected"' : "";
      return `<option value="${DisplayModes[option].selectValue}"${selected}>${labels[option]}</option>`;
    })
    .join("");
  return `<select onchange="document.location='${base}?${Query}&amp;inline_set=dm_'+this.value+''">${options}</select>`;
}

function searchBox(base: string): string {
  const categories = ["Doujinshi", "Manga", "Artist CG", "Game CG", "Western"]
    .map((label) => `<td>${categoryDiv(label, "cs", base)}</td>`)
    .join("");
  return `<div id="searchbox" class="idi"><form action="${base}" method="get" style="margin:0px; padding:0px"><input type="hidden" id="f_cats" name="f_cats" value="0" disabled="disabled" /><table class="itc"><tr>${categories}</tr></table><div><input type="text" id="f_search" name="f_search" placeholder="Search Keywords" value="sample" size="90" maxlength="200" /><input type="submit" value="Search" /></div></form></div>`;
}
