import { categoryDiv } from "./category";
import { escapeHtml, pageShell, type Site, siteBase } from "./page-shell";

/** One row of a compact-mode list, in the forms the site prints. */
export interface CompactRow {
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

export interface ListPage {
  readonly site: Site;
  readonly rows: readonly CompactRow[];
  /** The text of `div.searchtext`. */
  readonly searchText: string;
  /** The gid in the "Prev" link, or null when the page has no previous page. */
  readonly prevGid: number | null;
  /** The gid in the "Next" link, or null when the page is the last one. */
  readonly nextGid: number | null;
}

const PixelGif = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const Query = "f_search=sample";

export function compactRow(overrides: Partial<CompactRow> = {}): CompactRow {
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
    rows: [compactRow()],
    searchText: "Found 1,234 results.",
    prevGid: null,
    nextGid: null,
    ...overrides,
  };
  const base = siteBase(page.site);
  const rows = page.rows.map((row) => renderRow(row, base)).join("");
  return pageShell(
    page.site,
    `<div class="ido">${searchBox(base)}<div style="position:relative; z-index:2"><div id="rangebar"></div><div class="searchtext"><p>${page.searchText}</p></div>${searchNav("u", page, base)}<table class="itg gltc">${HeaderRow}${rows}</table>${searchNav("d", page, base)}</div></div>`,
  );
}

/** Captured in 2019: the table keeps its header and holds one message row. */
export function filteredOutPageHtml(site: Site = "eh"): string {
  const base = siteBase(site);
  const message = `<tr><td style="text-align:center; font-style:italic; padding:10px 0" colspan="4">No unfiltered results in this page range. You either requested an invalid page or used too aggressive filters.</td></tr>`;
  return pageShell(
    site,
    `<div class="ido">${searchBox(base)}<div style="position:relative; z-index:2"><div class="searchtext"><p>Found 1,234 results. Your custom filters removed 25 galleries from this page.</p></div><table class="itg gltc">${HeaderRow}${message}</table></div></div>`,
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

const HeaderRow = `<tr><th></th><th>Published</th><th>Title</th><th class="glhide">Uploader</th></tr>`;

function renderRow(row: CompactRow, base: string): string {
  const popup = `${base}gallerypopups.php?gid=${row.gid}&amp;t=${row.token}&amp;act=addfav`;
  const posted = (id: string) =>
    `<div onclick="popUp('${popup}',675,415)" id="${id}_${row.gid}">${row.posted}</div>`;
  const stars = `<div class="ir" style="background-position:${row.ratingPosition};opacity:1"></div>`;
  const title = escapeHtml(row.title);
  const image = row.lazyThumbnail
    ? `<img style="height:354px;width:250px" alt="${title}" title="${title}" src="${PixelGif}" data-src="${row.thumbnail}" />`
    : `<img style="height:354px;width:250px" alt="${title}" title="${title}" src="${row.thumbnail}" />`;
  const torrent = row.torrents
    ? `<a href="${base}gallerytorrents.php?gid=${row.gid}&amp;t=${row.token}" onclick="return popUp('${base}gallerytorrents.php?gid=${row.gid}&amp;t=${row.token}', 610, 590)" rel="nofollow"><img src="https://ehgt.org/g/t.png" alt="T" title="Show torrents" /></a>`
    : `<img src="https://ehgt.org/g/td.png" alt="T" title="No torrents available" />`;
  // The visible text drops the namespace; only the title attribute has the whole tag.
  const tags = row.tags
    .map(
      (tag) =>
        `<div class="gt" title="${escapeHtml(tag)}">${escapeHtml(tag.slice(tag.indexOf(":") + 1))}</div>`,
    )
    .join("");
  const uploader = escapeHtml(row.uploader);

  return `<tr><td class="gl1c glcat">${categoryDiv(row.category, "cn", base)}</td><td class="gl2c"><div class="glcut" id="ic${row.gid}"></div><div class="glthumb" id="it${row.gid}" style="top:-22px;height:400px"><div>${image}</div><div><div>${categoryDiv(row.category, "cn", base)}${posted("postedpop")}</div><div>${stars}<div>${row.pages} pages</div></div></div></div><div>${posted("posted")}${stars}<div class="gldown">${torrent}</div></div></td><td class="gl3c glname" onmouseover="show_image_pane(${row.gid});preload_pane_image(0,${row.gid})" onmouseout="hide_image_pane(${row.gid})"><a href="${base}g/${row.gid}/${row.token}/"><div class="glink">${title}</div><div>${tags}</div></a></td><td class="gl4c glhide"><div><a href="${base}uploader/${encodeURIComponent(row.uploader)}">${uploader}</a></div><div>${row.pages} pages</div></td></tr>`;
}

/** The site prints the pager twice: `u` above the table and `d` below it. */
function searchNav(position: "u" | "d", page: ListPage, base: string): string {
  const link = (id: string, cursor: string | null, label: string) =>
    cursor === null
      ? `<span id="${position}${id}">${label}</span>`
      : `<a id="${position}${id}" href="${base}?${Query}${cursor}">${label}</a>`;
  const prev = page.prevGid === null ? null : `&amp;prev=${page.prevGid}`;
  const next = page.nextGid === null ? null : `&amp;next=${page.nextGid}`;
  return `<div class="searchnav"><div></div><div>${link("first", prev === null ? null : "", "&lt;&lt; First")}</div><div>${link("prev", prev, "&lt; Prev")}</div><div id="${position}jumpbox" class="jumpbox"><a id="${position}jump" href="javascript:enable_jump_mode('${position}')">Jump/Seek</a></div><div>${link("next", next, "Next &gt;")}</div><div>${link("last", next === null ? null : "&amp;prev=1", "Last &gt;&gt;")}</div><div></div></div>`;
}

function searchBox(base: string): string {
  const categories = ["Doujinshi", "Manga", "Artist CG", "Game CG", "Western"]
    .map((label) => `<td>${categoryDiv(label, "cs", base)}</td>`)
    .join("");
  return `<div id="searchbox" class="idi"><form action="${base}" method="get" style="margin:0px; padding:0px"><input type="hidden" id="f_cats" name="f_cats" value="0" disabled="disabled" /><table class="itc"><tr>${categories}</tr></table><div><input type="text" id="f_search" name="f_search" placeholder="Search Keywords" value="sample" size="90" maxlength="200" /><input type="submit" value="Search" /></div></form></div>`;
}
