/** Pure decoders from the site's text to values. Null means the text is not in the expected form. */
import type { Category, GalleryRef, PreviewPage, Tag } from "./readings";

const Categories: Readonly<Record<string, Category>> = {
  Doujinshi: "doujinshi",
  Manga: "manga",
  "Artist CG": "artistCg",
  "Game CG": "gameCg",
  Western: "western",
  "Non-H": "nonH",
  "Image Set": "imageSet",
  Cosplay: "cosplay",
  "Asian Porn": "asianPorn",
  Misc: "misc",
};

const Months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** One star of the rating sprite is 16 px wide; the half-star row sits 20 px lower. */
const StarWidthPx = 16;
const HalfStarRowPx = -21;
const FullStarRowPx = -1;

/** Collapses runs of whitespace, NBSP included, the way a browser renders the text. */
export function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function readNonEmpty(text: string | undefined): string | null {
  const value = normalizeSpace(text ?? "");
  return value === "" ? null : value;
}

export function readCategory(label: string | undefined): Category | null {
  return Categories[normalizeSpace(label ?? "")] ?? null;
}

/** The site prints times in UTC as `yyyy-MM-dd HH:mm`. */
export function readSiteTime(text: string | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(normalizeSpace(text ?? ""));
  if (match === null) {
    return null;
  }

  const [, year, month, day, hour, minute] = match.map(Number);
  return toUtc(year, month, day, hour, minute);
}

/** Comments print `dd MMMM yyyy, HH:mm`, also in UTC. */
export function readCommentTime(text: string | undefined): string | null {
  const match = /^(\d{2}) ([A-Za-z]+) (\d{4}), (\d{2}):(\d{2})$/.exec(normalizeSpace(text ?? ""));
  if (match === null) {
    return null;
  }

  const month = Months.indexOf(match[2] ?? "") + 1;
  return month === 0
    ? null
    : toUtc(Number(match[3]), month, Number(match[1]), Number(match[4]), Number(match[5]));
}

function toUtc(
  year: number | undefined,
  month: number | undefined,
  day: number | undefined,
  hour: number | undefined,
  minute: number | undefined,
): string | null {
  if (year === undefined || month === undefined || day === undefined) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day, hour ?? 0, minute ?? 0));
  const isSameDay = date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isSameDay && (hour ?? 0) < 24 && (minute ?? 0) < 60
    ? date.toISOString().replace(".000Z", "Z")
    : null;
}

/** Reads stars from the sprite offset in a `style` attribute, for example `-16px -21px` is 3.5. */
export function readStars(style: string | undefined): number | null {
  const match = /background-position:\s*(-?\d+)px\s+(-?\d+)px/.exec(style ?? "");
  const x = Number(match?.[1]);
  const y = Number(match?.[2]);
  if (
    match === null ||
    x > 0 ||
    x % StarWidthPx !== 0 ||
    ![FullStarRowPx, HalfStarRowPx].includes(y)
  ) {
    return null;
  }

  const stars = 5 + x / StarWidthPx - (y === HalfStarRowPx ? 0.5 : 0);
  return stars >= 0 ? stars : null;
}

export function readPageCount(text: string | undefined): number | null {
  return readInteger(/^(\d+) pages?$/.exec(normalizeSpace(text ?? ""))?.[1]);
}

/** "Never", "Once" or "N times". */
export function readFavoritedCount(text: string | undefined): number | null {
  const value = normalizeSpace(text ?? "");
  if (value === "Never") {
    return 0;
  }

  return value === "Once" ? 1 : readInteger(/^(\d+) times$/.exec(value)?.[1]);
}

export function readGalleryLink(href: string | undefined): GalleryRef | null {
  const match = /\/g\/(\d+)\/([0-9a-f]{10})\/$/.exec(href ?? "");
  const gid = readInteger(match?.[1]);
  return gid === null || match?.[2] === undefined ? null : { gid, token: match[2] };
}

export function readPreviewLink(href: string | undefined, gid: number): PreviewPage | null {
  const match = /\/s\/([0-9a-f]{10})\/(\d+)-(\d+)$/.exec(href ?? "");
  const number = readInteger(match?.[3]);
  return match?.[1] === undefined || Number(match[2]) !== gid || number === null
    ? null
    : { number, pageToken: match[1] };
}

/** The gid in a pager link: `next=<gid>` or `prev=<gid>`. */
export function readCursor(href: string | undefined, direction: "next" | "prev"): number | null {
  return readInteger(new RegExp(`[?&]${direction}=(\\d+)(?:&|$)`).exec(href ?? "")?.[1]);
}

/** `Found 1,234 results.` states a total; `Found thousands of results.` does not. */
export function readSearchText(text: string | undefined): { total?: number; filteredOut?: number } {
  const value = normalizeSpace(text ?? "");
  const total = readInteger(/^Found ([\d,]+) results?\b/.exec(value)?.[1]);
  const filteredOut = readInteger(/filters removed (\d+) galler(?:y|ies)\b/.exec(value)?.[1]);
  return {
    ...(total === null ? {} : { total }),
    ...(filteredOut === null ? {} : { filteredOut }),
  };
}

/** Each list tag carries its whole name in its `title`: `namespace:name`. */
export function readTag(title: string | undefined): Tag | null {
  const match = /^([a-z]+):(.+)$/.exec(normalizeSpace(title ?? ""));
  return match?.[1] === undefined || match[2] === undefined
    ? null
    : { namespace: match[1], name: match[2] };
}

export function readScriptVariables(
  script: string,
): { readonly gid: number; readonly token: string; readonly apiuid: number } | null {
  const gid = readInteger(/\bvar gid = (\d+);/.exec(script)?.[1]);
  const token = /\bvar token = "([0-9a-f]{10})";/.exec(script)?.[1];
  const apiuid = /\bvar apiuid = (-?\d+);/.exec(script)?.[1];
  return gid === null || token === undefined || apiuid === undefined
    ? null
    : { gid, token, apiuid: Number(apiuid) };
}

/** "Average: 4.46" is a rating; "Not Yet Rated" is the page saying there is none. */
export function readRatingAverage(text: string | undefined): number | "notRated" | null {
  const value = normalizeSpace(text ?? "");
  if (value === "Not Yet Rated") {
    return "notRated";
  }

  const average = Number(/^Average: (\d(?:\.\d+)?)$/.exec(value)?.[1]);
  return Number.isNaN(average) || average > 5 ? null : average;
}

export function readTorrentCount(text: string | undefined): number | null {
  return readInteger(/^Torrent Download \((\d+)\)$/.exec(normalizeSpace(text ?? ""))?.[1]);
}

/** `Showing 1 - 20 of 838 images`. */
export function readShowing(
  text: string | undefined,
): { readonly first: number; readonly last: number; readonly total: number } | null {
  const match = /^Showing ([\d,]+) - ([\d,]+) of ([\d,]+) images?$/.exec(
    normalizeSpace(text ?? ""),
  );
  const first = readInteger(match?.[1]);
  const last = readInteger(match?.[2]);
  const total = readInteger(match?.[3]);
  return first === null || last === null || total === null ? null : { first, last, total };
}

/** The header reads `Posted on 26 September 2026, 09:15 by: <author>`. */
export function readCommentPosted(header: string | undefined, author: string): string | null {
  const text = normalizeSpace(header ?? "");
  if (!text.endsWith(author)) {
    return null;
  }

  const posted = /^Posted on (.+) by:$/.exec(text.slice(0, -author.length).trim())?.[1];
  return readCommentTime(posted);
}

export function readScore(text: string | undefined): number | null {
  return readSignedInteger(normalizeSpace(text ?? ""));
}

/** "Yes", or "No" followed by the reason the gallery is hidden. */
export function readVisible(text: string | undefined): boolean | null {
  const value = normalizeSpace(text ?? "");
  if (value === "Yes") {
    return true;
  }

  return /^No\b/.test(value) ? false : null;
}

export function readInteger(text: string | undefined): number | null {
  return text !== undefined && /^[\d,]+$/.test(text) ? Number(text.replaceAll(",", "")) : null;
}

function readSignedInteger(text: string): number | null {
  return /^[+-]?\d+$/.test(text) ? Number(text) : null;
}
