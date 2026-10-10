import {
  normalizeSpace,
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
  readScore,
  readScriptVariables,
  readShowing,
  readSiteTime,
  readTorrentCount,
  readVisible,
} from "./decoders";
import { assembling, need } from "./need";
import type { RawComment, RawDetailPage, RawMetadataRow, RawTagGroup } from "./raw";
import {
  type CommentReading,
  type DetailFailureCode,
  type DetailParse,
  type DetailReading,
  failure,
  type GalleryRef,
  isUnrecognized,
  success,
  type Tag,
} from "./readings";

const ContentWarningText =
  "(And if you choose to ignore this warning, you lose all rights to complain about it in the future.)";

/** Error-box messages with an outcome of their own; any other message is a `site_error`. */
const ErrorBoxCodes: readonly [prefix: string, code: DetailFailureCode][] = [
  ["This gallery is pining for the fjords.", "gallery_removed"],
  ["This gallery is unavailable", "gallery_unavailable"],
  ["Key missing, or incorrect key provided.", "invalid_token"],
];

export function assembleDetailPage(raw: RawDetailPage): DetailParse {
  if (raw.paragraphs.some((text) => normalizeSpace(text) === ContentWarningText)) {
    return failure("content_warning");
  }

  if (raw.errorBox !== undefined) {
    const message = normalizeSpace(raw.errorBox);
    const code = ErrorBoxCodes.find(([prefix]) => message.startsWith(prefix))?.[1];
    return failure(code ?? "site_error", message);
  }

  const reading = assembling(() => assembleReading(raw));
  return isUnrecognized(reading) ? reading : success(reading);
}

function assembleReading(raw: RawDetailPage): DetailReading {
  const variables = need(
    raw.scripts.map(readScriptVariables).find((found) => found !== null),
    "script: var gid, token, apiuid",
    "",
  );
  const field = <T>(label: string, decode: (value: string | undefined) => T | null): T => {
    const value = readMetadataRow(raw.metadata, label).value;
    return need(decode(value), `#gdd ${label}`, value);
  };
  return {
    ...variables,
    title: need(readNonEmpty(raw.title), "#gn", raw.title),
    titleJpn: readNonEmpty(need(raw.titleJpn, "#gj", "")),
    category: need(readCategory(raw.category), "#gdc div.cs", raw.category),
    uploader: need(readNonEmpty(raw.uploader), "#gdn a", raw.uploader),
    posted: field("Posted", readSiteTime),
    parent: readParent(readMetadataRow(raw.metadata, "Parent")),
    visible: field("Visible", readVisible),
    language: field("Language", readNonEmpty),
    fileCount: field("Length", readPageCount),
    favoritedCount: field("Favorited", readFavoritedCount),
    rating: readRating(raw),
    tags: raw.tagGroups.flatMap(readTagGroup),
    torrentCount: need(
      raw.actionTexts.map(readTorrentCount).find((count) => count !== null),
      "#gd5 a: Torrent Download (n)",
      "",
    ),
    previews: readPreviews(raw, variables.gid),
    comments: raw.comments.map(readComment),
  };
}

function readMetadataRow(rows: readonly RawMetadataRow[], label: string): RawMetadataRow {
  const row = rows.find((candidate) => normalizeSpace(candidate.label ?? "") === `${label}:`);
  return need(row, `#gdd ${label}`, "");
}

/** "None", or a link to the parent gallery. */
function readParent(row: RawMetadataRow): GalleryRef | null {
  return normalizeSpace(row.value ?? "") === "None"
    ? null
    : need(readGalleryLink(row.href), "#gdd Parent a[href]", row.href ?? row.value);
}

function readRating(raw: RawDetailPage): DetailReading["rating"] {
  const average = need(readRatingAverage(raw.ratingLabel), "#rating_label", raw.ratingLabel);
  const count = need(
    readInteger(normalizeSpace(raw.ratingCount ?? "")),
    "#rating_count",
    raw.ratingCount,
  );
  return average === "notRated" ? null : { average, count };
}

function readTagGroup(group: RawTagGroup): Tag[] {
  const namespace = need(
    /^([a-z]+):$/.exec(normalizeSpace(group.namespace ?? ""))?.[1],
    "#taglist td.tc",
    group.namespace,
  );
  need(group.names[0], "#taglist div[id^=td_] a", "");
  return group.names.map((name) => ({
    namespace,
    name: need(readNonEmpty(name), "#taglist div[id^=td_] a", name),
  }));
}

function readPreviews(raw: RawDetailPage, gid: number): DetailReading["previews"] {
  const showing = need(readShowing(raw.showing), "div.gtb p.gpc", raw.showing);
  const pages = raw.previewHrefs.map((href) =>
    need(readPreviewLink(href, gid), "#gdt a[href]", href),
  );
  const expected = showing.last - showing.first + 1;
  need(pages.length === expected ? pages : null, "#gdt a", `${pages.length} of ${expected} links`);
  return { ...showing, pages };
}

function readComment(comment: RawComment): CommentReading {
  const elementId = comment.elementId ?? "";
  const commentId = need(
    readInteger(/^comment_(\d+)$/.exec(elementId)?.[1]),
    "div.c6[id]",
    elementId,
  );
  const author = need(readNonEmpty(comment.author), "div.c3 a", comment.author);
  const isUploader = commentId === 0;
  return {
    commentId,
    author,
    isUploader,
    postedAt: need(readCommentPosted(comment.header, author), "div.c3", comment.header),
    editedAt:
      comment.edited === undefined
        ? null
        : need(readCommentTime(comment.edited), "div.c8 strong", comment.edited),
    score: isUploader ? null : need(readScore(comment.score), "div.c5 span", comment.score),
    bodyText: comment.body.split("\n").map(normalizeSpace).join("\n").trim(),
  };
}
