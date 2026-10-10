/** Pure decoders from the site's text to values. Null means the text is not in the expected form. */
import type { Category, GalleryRef, Tag } from "../domain/gallery";

/** A page of a gallery as preview links name it. */
export interface PageKey {
  readonly number: number;
  readonly pageToken: string;
}

const CategoryLabels: Readonly<Record<string, Category>> = {
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

const SecondsPerUnit: Readonly<Record<string, number>> = {
  day: 24 * 60 * 60,
  hour: 60 * 60,
  minute: 60,
  second: 1,
};

/** Collapses runs of whitespace, NBSP included, the way a browser renders the text. */
export function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function readNonEmpty(text: string | undefined): string | null {
  const value = normalizeSpace(text ?? "");
  return value === "" ? null : value;
}

/** Pages and `gdata` use the same labels. */
export function readCategory(label: string | undefined): Category | null {
  return CategoryLabels[normalizeSpace(label ?? "")] ?? null;
}

/** The site prints times in UTC as `yyyy-MM-dd HH:mm`. */
export function readSiteTime(text: string | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(normalizeSpace(text ?? ""));
  return match === null
    ? null
    : toUtc(
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
      );
}

/** Comments print `dd MMMM yyyy, HH:mm`, also in UTC. */
export function readCommentTime(text: string | undefined): string | null {
  const match = /^(\d{2}) ([A-Za-z]+) (\d{4}), (\d{2}):(\d{2})$/.exec(normalizeSpace(text ?? ""));
  const month = Months.indexOf(match?.[2] ?? "") + 1;
  return match === null || month === 0
    ? null
    : toUtc(Number(match[3]), month, Number(match[1]), Number(match[4]), Number(match[5]));
}

/** `gdata` gives `posted` as epoch seconds, in a string. */
export function readEpochSeconds(value: unknown): string | null {
  const seconds = readIntegerValue(value);
  return seconds === null ? null : new Date(seconds * 1000).toISOString().replace(".000Z", "Z");
}

function toUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string | null {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const isSameDay = date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isSameDay && hour < 24 && minute < 60 ? date.toISOString().replace(".000Z", "Z") : null;
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

export function readPreviewLink(href: string | undefined, gid: number): PageKey | null {
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

/** `namespace:name`, as `gdata` writes tags when asked for namespaces. */
export function readTag(text: string | undefined): Tag | null {
  const match = /^([a-z]+):(.+)$/.exec(normalizeSpace(text ?? ""));
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

/** A single page writes its variables without spaces: `var startkey="…";`. */
export function readSinglePageVariables(script: string): {
  readonly gid: number;
  readonly number: number;
  readonly pageToken: string;
  readonly showkey: string;
} | null {
  const gid = readInteger(/\bvar gid=(\d+);/.exec(script)?.[1]);
  const number = readInteger(/\bvar startpage=(\d+);/.exec(script)?.[1]);
  const pageToken = /\bvar startkey="([0-9a-f]{10})";/.exec(script)?.[1];
  const showkey = /\bvar showkey="([0-9a-z]+)";/.exec(script)?.[1];
  return gid === null || number === null || pageToken === undefined || showkey === undefined
    ? null
    : { gid, number, pageToken, showkey };
}

/** "Average: 4.12" is a rating; "Not Yet Rated" is the page saying there is none. */
export function readRatingAverage(text: string | undefined): number | "notRated" | null {
  const value = normalizeSpace(text ?? "");
  if (value === "Not Yet Rated") {
    return "notRated";
  }

  return readRatingValue(/^Average: (.+)$/.exec(value)?.[1]);
}

/** A rating from 0 to 5, written as a decimal number. */
export function readRatingValue(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !/^\d(?:\.\d+)?$/.test(text)) {
    return null;
  }

  const rating = Number(text);
  return rating <= 5 ? rating : null;
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
  if (author === "" || !text.endsWith(author)) {
    return null;
  }

  const posted = /^Posted on (.+) by:$/.exec(text.slice(0, -author.length).trim())?.[1];
  return readCommentTime(posted);
}

/** A comment score such as `+12`, or a tag weight such as `-5`. */
export function readSignedInteger(text: string | undefined): number | null {
  const value = normalizeSpace(text ?? "");
  return /^[+-]?\d+$/.test(value) ? Number(value) : null;
}

/** "Yes", or "No" followed by the reason the gallery is hidden. */
export function readVisible(text: string | undefined): boolean | null {
  const value = normalizeSpace(text ?? "");
  if (value === "Yes") {
    return true;
  }

  return /^No\b/.test(value) ? false : null;
}

/** `The ban expires in 59 minutes and 48 seconds`: the wait, in seconds. */
export function readBanExpiry(text: string): number | null {
  const parts = /The ban expires in (.+?)\.?$/.exec(normalizeSpace(text))?.[1]?.split(/, | and /);
  if (parts === undefined) {
    return null;
  }

  let seconds = 0;
  for (const part of parts) {
    const match = /^(\d+) (day|hour|minute|second)s?$/.exec(part);
    const unit = SecondsPerUnit[match?.[2] ?? ""];
    if (match === null || unit === undefined) {
      return null;
    }

    seconds += Number(match[1]) * unit;
  }

  return seconds;
}

/** A whole number written with optional thousands separators. */
export function readInteger(text: string | undefined): number | null {
  return text !== undefined && /^\d{1,3}(?:,?\d{3})*$/.test(text)
    ? Number(text.replaceAll(",", ""))
    : null;
}

/** `gdata` writes some counts as numbers and others as strings of digits. */
export function readIntegerValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
}
