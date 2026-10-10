import { displayModeShape, type GalleryRow, galleryRow } from "./list-page";
import { pageShell, type Site, siteBase } from "./page-shell";

/** One gallery of a toplist, with its rank and score. */
export interface ToplistRow {
  readonly gallery: GalleryRow;
  readonly rank: number;
  /** As the page prints it, such as `12,345`. */
  readonly score: string;
}

export interface ToplistPage {
  readonly site: Site;
  /** The `tl` code: 11, 12, 13 or 15 for the galleries toplists. */
  readonly code: number;
  /** The heading's name for it, such as `Galleries Yesterday`. */
  readonly name: string;
  /** Counted from 0. */
  readonly page: number;
  readonly pageCount: number;
  readonly rows: readonly ToplistRow[];
}

/** The pager shows the first seven pages, the page shown and the last one. */
const LeadingPages = 7;

export function toplistRow(overrides: Partial<ToplistRow> = {}): ToplistRow {
  return { gallery: galleryRow(), rank: 1, score: "12,345", ...overrides };
}

/** The list is printed in Compact mode, with the rank and score in a first cell. */
export function galleryToplistPageHtml(overrides: Partial<ToplistPage> = {}): string {
  const page: ToplistPage = {
    site: "eh",
    code: 15,
    name: "Galleries Yesterday",
    page: 0,
    pageCount: 200,
    rows: [toplistRow()],
    ...overrides,
  };
  const base = siteBase(page.site);
  const compact = displayModeShape("compact");
  const rows = page.rows.map((row) =>
    compact
      .renderRow(row.gallery, base)
      .replace(/^<tr>/, `<tr><td><p>#${row.rank}</p><p>${row.score}</p></td>`),
  );
  return pageShell(
    page.site,
    `<div class="ido"><h1 class="ih"><a href="${base}toplist.php">EHG Toplists</a> &gt; <a href="${base}toplist.php?tl=${page.code}">${page.name}</a></h1>${pager("ptt", page, base)}<table class="itg gltc" style="max-width:1250px"><tr><th colspan="2">&nbsp;</th><th>Published</th><th>Name</th><th>Uploader</th></tr>${rows.join("")}</table>${pager("ptb", page, base)}</div>`,
    "E-Hentai Gallery Toplists - E-Hentai Galleries",
  );
}

/** Pages show from 1 but link from `p=0`, which the first page's link leaves out. */
function pager(kind: "ptt" | "ptb", page: ToplistPage, base: string): string {
  const href = (number: number) =>
    `${base}toplist.php?tl=${page.code}${number === 0 ? "" : `&amp;p=${number}`}`;
  const link = (number: number, label: string) =>
    `<td onclick="document.location=this.firstChild.href"><a href="${href(number)}" onclick="return false">${label}</a></td>`;
  const last = page.pageCount - 1;
  const numbers = [...new Set([...Array(LeadingPages).keys(), page.page, last])]
    .filter((number) => number <= last)
    .sort((a, b) => a - b);
  const cells = numbers.map((number, index) => {
    const gap = index > 0 && number > (numbers[index - 1] ?? 0) + 1 ? "<td> ... </td>" : "";
    const cell =
      number === page.page
        ? `<td class="ptds"><a href="${href(number)}" onclick="return false">${number + 1}</a></td>`
        : link(number, String(number + 1));
    return `${gap}${cell}`;
  });
  const prev = page.page === 0 ? `<td class="ptdd">&lt;</td>` : link(page.page - 1, "&lt;");
  const next = page.page === last ? `<td class="ptdd">&gt;</td>` : link(page.page + 1, "&gt;");
  return `<table class="${kind}" style="margin:2px auto 0px"><tr>${prev}${cells.join("")}${next}</tr></table>`;
}
