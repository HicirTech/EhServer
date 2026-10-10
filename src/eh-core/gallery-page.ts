/** The gallery page `/g/<gid>/<token>/`: the gallery, one page of previews, and the comments. */
import type { Category, GalleryRef, Tag } from "../domain/gallery";
import {
  normalizeSpace,
  type PageKey,
  readCategory,
  readCommentPosted,
  readCommentTime,
  readFavoritedCount,
  readGalleryLink,
  readInteger,
  readNonEmpty,
  readPageCount,
  readPreviewLink,
  readRatingAverage,
  readScriptVariables,
  readShowing,
  readSignedInteger,
  readSiteTime,
  readTorrentCount,
  readVisible,
} from "./decoders";
import {
  attribute,
  type Document,
  type Element,
  find,
  findAll,
  parseHtml,
  text,
  textWithBreaks,
} from "./html";
import {
  assembling,
  type FailureCode,
  failure,
  isUnrecognized,
  need,
  type ParseResult,
  success,
} from "./parse-result";

export interface GalleryPageGallery extends GalleryRef {
  readonly title: string;
  readonly titleJpn: string | null;
  readonly category: Category;
  readonly uploader: string;
  readonly posted: string;
  readonly parent: GalleryRef | null;
  readonly visible: boolean;
  readonly fileCount: number;
  readonly favoritedCount: number;
  /** `average` is null when the page says "Not Yet Rated". */
  readonly rating: { readonly average: number | null; readonly count: number };
  readonly tags: readonly Tag[];
  readonly torrentCount: number;
}

/** One page of previews; `p` in the URL picks which. */
export interface PreviewRange {
  readonly first: number;
  readonly last: number;
  readonly total: number;
  readonly pages: readonly PageKey[];
}

export interface CommentReading {
  readonly commentId: number;
  readonly author: string;
  readonly isUploader: boolean;
  readonly postedAt: string;
  readonly editedAt: string | null;
  /** Null for the uploader's comment, which has no score. */
  readonly score: number | null;
  /** Line breaks kept as `\n`. */
  readonly bodyText: string;
}

export interface GalleryPageReading {
  readonly gallery: GalleryPageGallery;
  readonly previews: PreviewRange;
  readonly comments: readonly CommentReading[];
  /** Account-scoped, so kept apart from the gallery (docs/domain-model.md I1). Below 0 without an account. */
  readonly viewer: { readonly apiuid: number };
}

const ContentWarningText =
  "(And if you choose to ignore this warning, you lose all rights to complain about it in the future.)";

/** Error-box messages with an outcome of their own; any other message is a `site_error`. */
const ErrorBoxCodes: readonly [prefix: string, code: FailureCode][] = [
  ["This gallery is pining for the fjords.", "gallery_removed"],
  ["This gallery is unavailable", "gallery_unavailable"],
  ["Key missing, or incorrect key provided.", "invalid_token"],
];

/** `expected` is the gallery that was requested; a page for any other one is unrecognized. */
export function parseGalleryPage(
  html: string,
  expected: GalleryRef,
): ParseResult<GalleryPageReading> {
  const document = parseHtml(html);
  const paragraphs = findAll("p", document).map((paragraph) =>
    normalizeSpace(text(paragraph) ?? ""),
  );
  if (paragraphs.includes(ContentWarningText)) {
    return failure("content_warning");
  }

  const errorBox = find("div.d p", document);
  if (errorBox !== null) {
    const message = normalizeSpace(text(errorBox) ?? "");
    const code = ErrorBoxCodes.find(([prefix]) => message.startsWith(prefix))?.[1];
    return failure(code ?? "site_error", message);
  }

  const reading = assembling(() => readGalleryPage(document, expected));
  return isUnrecognized(reading) ? reading : success(reading);
}

function readGalleryPage(document: Document, expected: GalleryRef): GalleryPageReading {
  const scripts = findAll("script", document).map((script) => text(script) ?? "");
  const variables = need(
    scripts.map(readScriptVariables).find((found) => found !== null),
    "script: var gid, token, apiuid",
    "",
  );
  const isExpected = variables.gid === expected.gid && variables.token === expected.token;
  need(
    isExpected ? variables : null,
    "script: var gid, token",
    `${variables.gid}/${variables.token}`,
  );
  return {
    gallery: readGallery(document, expected),
    previews: readPreviews(document, expected.gid),
    comments: findAll("#cdiv div.c1", document).map(readComment),
    viewer: { apiuid: variables.apiuid },
  };
}

function readGallery(document: Document, ref: GalleryRef): GalleryPageGallery {
  const first = (selector: string) => text(find(selector, document));
  const field = <T>(label: string, decode: (value: string | undefined) => T | null): T => {
    const value = text(find("td.gdt2", metadataRow(document, label)));
    return need(decode(value), `#gdd ${label}`, value);
  };
  return {
    gid: ref.gid,
    token: ref.token,
    title: need(readNonEmpty(first("#gn")), "#gn", first("#gn")),
    titleJpn: readNonEmpty(need(first("#gj"), "#gj", "")),
    category: need(readCategory(first("#gdc div.cs")), "#gdc div.cs", first("#gdc div.cs")),
    uploader: need(readNonEmpty(first('#gdn a[href*="/uploader/"]')), "#gdn a", first("#gdn")),
    posted: field("Posted", readSiteTime),
    parent: readParent(metadataRow(document, "Parent")),
    visible: field("Visible", readVisible),
    fileCount: field("Length", readPageCount),
    favoritedCount: field("Favorited", readFavoritedCount),
    rating: readRating(document),
    tags: findAll("#taglist tr", document).flatMap(readTagGroup),
    torrentCount: need(
      findAll("#gd5 a", document)
        .map((link) => readTorrentCount(text(link)))
        .find((count) => count !== null),
      "#gd5 a: Torrent Download (n)",
      "",
    ),
  };
}

function metadataRow(document: Document, label: string): Element {
  const rows = findAll("#gdd tr", document);
  const row = rows.find(
    (candidate) => normalizeSpace(text(find("td.gdt1", candidate)) ?? "") === `${label}:`,
  );
  return need(row, `#gdd ${label}`, "");
}

/** "None", or a link to the parent gallery. */
function readParent(row: Element): GalleryRef | null {
  const cell = find("td.gdt2", row);
  if (normalizeSpace(text(cell) ?? "") === "None") {
    return null;
  }

  const href = attribute(find("a", cell ?? row), "href");
  return need(readGalleryLink(href), "#gdd Parent a[href]", href);
}

function readRating(document: Document): GalleryPageGallery["rating"] {
  const label = text(find("#rating_label", document));
  const average = need(readRatingAverage(label), "#rating_label", label);
  const countText = text(find("#rating_count", document));
  const count = need(readInteger(normalizeSpace(countText ?? "")), "#rating_count", countText);
  return { average: average === "notRated" ? null : average, count };
}

function readTagGroup(row: Element): Tag[] {
  const label = text(find("td.tc", row));
  const namespace = need(
    /^([a-z]+):$/.exec(normalizeSpace(label ?? ""))?.[1],
    "#taglist td.tc",
    label,
  );
  const names = findAll('div[id^="td_"] a', row).map((link) => text(link));
  need(names[0], "#taglist div[id^=td_] a", "");
  return names.map((name) => ({
    namespace,
    name: need(readNonEmpty(name), "#taglist div[id^=td_] a", name),
  }));
}

function readPreviews(document: Document, gid: number): PreviewRange {
  const showingText = text(find("div.gtb p.gpc", document));
  const showing = need(readShowing(showingText), "div.gtb p.gpc", showingText);
  const pages = findAll('#gdt a[href*="/s/"]', document).map((link) => {
    const href = attribute(link, "href");
    return need(readPreviewLink(href, gid), "#gdt a[href]", href);
  });
  const expected = showing.last - showing.first + 1;
  need(pages.length === expected ? pages : null, "#gdt a", `${pages.length} of ${expected} links`);
  return { ...showing, pages };
}

function readComment(comment: Element): CommentReading {
  const body = find("div.c6", comment);
  const elementId = attribute(body, "id") ?? "";
  const commentId = need(
    readInteger(/^comment_(\d+)$/.exec(elementId)?.[1]),
    "div.c6[id]",
    elementId,
  );
  const authorText = text(find("div.c3 a", comment));
  const author = need(readNonEmpty(authorText), "div.c3 a", authorText);
  const header = text(find("div.c3", comment));
  const edited = find("div.c8 strong", comment);
  const scoreText = text(find("div.c5 span", comment));
  const isUploader = commentId === 0;
  return {
    commentId,
    author,
    isUploader,
    postedAt: need(readCommentPosted(header, author), "div.c3", header),
    editedAt:
      edited === null ? null : need(readCommentTime(text(edited)), "div.c8 strong", text(edited)),
    score: isUploader ? null : need(readSignedInteger(scoreText), "div.c5 span", scoreText),
    bodyText: (body === null ? "" : textWithBreaks(body.children))
      .split("\n")
      .map(normalizeSpace)
      .join("\n")
      .trim(),
  };
}
