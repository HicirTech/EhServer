/**
 * The `gdata` API answer: metadata for up to 25 galleries. Each requested gallery gets its own
 * result, so one bad token does not fail the batch (wiki: EhServer-Implications, section 7).
 * Field names and types follow the official documentation (wiki: API, section 0).
 */
import type { Category, GalleryRef, Tag } from "../domain/gallery";
import {
  readCategory,
  readEpochSeconds,
  readIntegerValue,
  readNonEmpty,
  readRatingValue,
  readTag,
} from "./decoders";
import { asString, excerpt, isJsonObject, type JsonObject, parseJsonObject } from "./json";
import {
  assembling,
  type Failure,
  failure,
  isUnrecognized,
  need,
  type ParseResult,
  type Success,
  success,
  type Unrecognized,
  unrecognized,
} from "./parse-result";

export interface GdataTorrent {
  readonly hash: string;
  readonly addedAt: string;
  readonly name: string;
  readonly torrentSize: number;
  readonly fileSize: number;
}

export interface GdataGallery extends GalleryRef {
  readonly title: string;
  readonly titleJpn: string | null;
  readonly category: Category;
  readonly uploader: string | null;
  readonly posted: string;
  readonly fileCount: number;
  readonly fileSize: number;
  readonly expunged: boolean;
  /** The average rating, 0 to 5. */
  readonly rating: number;
  readonly torrentCount: number;
  readonly torrents: readonly GdataTorrent[];
  readonly tags: readonly Tag[];
  readonly lineage: {
    readonly parent?: GalleryRef;
    readonly first?: GalleryRef;
    readonly current?: GalleryRef;
  };
  /** The upstream cover image; it stays inside eh-core and the server (docs/domain-model.md I5). */
  readonly coverUrl: string;
}

export type GdataItem = Success<GdataGallery> | Failure | Unrecognized;

export interface GdataReading {
  /** One result for every requested gallery, by gid. */
  readonly items: ReadonlyMap<number, GdataItem>;
}

const TokenPattern = /^[0-9a-f]{10}$/;
const TorrentHashPattern = /^[0-9a-f]{40}$/;
const KeyErrorPrefix = "Key missing, or incorrect key provided.";

export function parseGdata(
  body: string,
  requested: readonly GalleryRef[],
): ParseResult<GdataReading> {
  const answer = parseJsonObject(body);
  if (answer === null) {
    return unrecognized("gdata: JSON object", excerpt(body));
  }

  if (typeof answer.error === "string") {
    return failure("site_error", answer.error);
  }

  const entries = answer.gmetadata;
  if (!Array.isArray(entries)) {
    return unrecognized("gdata: gmetadata", excerpt(body));
  }

  const byGid = new Map<number, JsonObject>();
  for (const entry of entries) {
    const gid = isJsonObject(entry) ? readIntegerValue(entry.gid) : null;
    if (gid !== null && isJsonObject(entry)) {
      byGid.set(gid, entry);
    }
  }

  const items = new Map<number, GdataItem>(
    requested.map((ref) => [ref.gid, readItem(byGid.get(ref.gid), ref)]),
  );
  return success({ items });
}

function readItem(entry: JsonObject | undefined, ref: GalleryRef): GdataItem {
  if (entry === undefined) {
    return unrecognized("gdata: gmetadata[gid]", String(ref.gid));
  }

  if (typeof entry.error === "string") {
    return failure(
      entry.error.startsWith(KeyErrorPrefix) ? "invalid_token" : "site_error",
      entry.error,
    );
  }

  const gallery = assembling(() => readGallery(entry, ref));
  return isUnrecognized(gallery) ? gallery : success(gallery);
}

function readGallery(entry: JsonObject, ref: GalleryRef): GdataGallery {
  const field = <T>(name: string, decode: (value: unknown) => T | null): T =>
    need(decode(entry[name]), `gdata: ${name}`, JSON.stringify(entry[name]));
  need(entry.token === ref.token ? entry.token : null, "gdata: token", String(entry.token));
  return {
    gid: ref.gid,
    token: ref.token,
    title: field("title", (value) => readNonEmpty(asString(value))),
    titleJpn: readNonEmpty(field("title_jpn", asString)),
    category: field("category", (value) => readCategory(asString(value))),
    uploader: readNonEmpty(field("uploader", asString)),
    posted: field("posted", readEpochSeconds),
    fileCount: field("filecount", readIntegerValue),
    fileSize: field("filesize", readIntegerValue),
    expunged: field("expunged", (value) => (typeof value === "boolean" ? value : null)),
    rating: field("rating", readRatingValue),
    torrentCount: field("torrentcount", readIntegerValue),
    torrents: field("torrents", (value) => (Array.isArray(value) ? value : null)).map(readTorrent),
    tags: field("tags", (value) => (Array.isArray(value) ? value : null)).map((tag) =>
      need(readTag(asString(tag)), "gdata: tags", JSON.stringify(tag)),
    ),
    lineage: readLineage(entry),
    coverUrl: field("thumb", (value) =>
      typeof value === "string" && value.startsWith("https://") ? value : null,
    ),
  };
}

function readTorrent(value: unknown): GdataTorrent {
  const torrent = need(
    isJsonObject(value) ? value : null,
    "gdata: torrents[]",
    JSON.stringify(value),
  );
  const field = <T>(name: string, decode: (value: unknown) => T | null): T =>
    need(decode(torrent[name]), `gdata: torrents[].${name}`, JSON.stringify(torrent[name]));
  return {
    hash: field("hash", (hash) =>
      typeof hash === "string" && TorrentHashPattern.test(hash) ? hash : null,
    ),
    addedAt: field("added", readEpochSeconds),
    name: field("name", (name) => readNonEmpty(asString(name))),
    torrentSize: field("tsize", readIntegerValue),
    fileSize: field("fsize", readIntegerValue),
  };
}

/** Each link is present only for galleries that have it. */
function readLineage(entry: JsonObject): GdataGallery["lineage"] {
  const parent = readLink(entry, "parent");
  const first = readLink(entry, "first");
  const current = readLink(entry, "current");
  return {
    ...(parent === null ? {} : { parent }),
    ...(first === null ? {} : { first }),
    ...(current === null ? {} : { current }),
  };
}

function readLink(entry: JsonObject, prefix: string): GalleryRef | null {
  const gidValue = entry[`${prefix}_gid`];
  const keyValue = entry[`${prefix}_key`];
  if (gidValue === undefined && keyValue === undefined) {
    return null;
  }

  return {
    gid: need(readIntegerValue(gidValue), `gdata: ${prefix}_gid`, JSON.stringify(gidValue)),
    token: need(
      typeof keyValue === "string" && TokenPattern.test(keyValue) ? keyValue : null,
      `gdata: ${prefix}_key`,
      JSON.stringify(keyValue),
    ),
  };
}
