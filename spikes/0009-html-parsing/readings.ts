/** What the two spike parsers read. Both return exactly these shapes, so their results compare. */

export type Category =
  | "doujinshi"
  | "manga"
  | "artistCg"
  | "gameCg"
  | "western"
  | "nonH"
  | "imageSet"
  | "cosplay"
  | "asianPorn"
  | "misc";

export interface Tag {
  readonly namespace: string;
  readonly name: string;
}

export interface GalleryRef {
  readonly gid: number;
  readonly token: string;
}

export interface ListItem extends GalleryRef {
  readonly title: string;
  readonly category: Category;
  /** UTC, RFC 3339. */
  readonly posted: string;
  /** Stars from 0 to 5 in halves. */
  readonly rating: number;
  readonly fileCount: number;
  readonly uploader: string;
  readonly tags: readonly Tag[];
  readonly thumbnail: string;
}

export interface ListReading {
  readonly items: readonly ListItem[];
  /** gid cursors; null when the page has no such link. */
  readonly prev: number | null;
  readonly next: number | null;
  /** Present only when the page states a number. */
  readonly total?: number;
  readonly filteredOut?: number;
}

export type ListEmptyReason = "noHits" | "filteredOut";

export interface PreviewPage {
  readonly number: number;
  readonly pageToken: string;
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

export interface DetailReading extends GalleryRef {
  /** Below 0 when the page was served without an account. */
  readonly apiuid: number;
  readonly title: string;
  readonly titleJpn: string | null;
  readonly category: Category;
  readonly uploader: string;
  readonly posted: string;
  readonly parent: GalleryRef | null;
  readonly visible: boolean;
  readonly language: string;
  readonly fileCount: number;
  readonly favoritedCount: number;
  /** Null when the page says "Not Yet Rated". */
  readonly rating: { readonly average: number; readonly count: number } | null;
  readonly tags: readonly Tag[];
  readonly torrentCount: number;
  readonly previews: {
    readonly first: number;
    readonly last: number;
    readonly total: number;
    readonly pages: readonly PreviewPage[];
  };
  readonly comments: readonly CommentReading[];
}

export type DetailFailureCode =
  | "content_warning"
  | "gallery_removed"
  | "gallery_unavailable"
  | "invalid_token"
  | "site_error";

export interface Success<T> {
  readonly kind: "success";
  readonly value: T;
}

export interface Empty<E extends string> {
  readonly kind: "empty";
  readonly reason: E;
}

export interface Failure<F extends string> {
  readonly kind: "failure";
  readonly code: F;
  readonly message: string;
}

export interface Unrecognized {
  readonly kind: "unrecognized";
  /** The selector or field that was missing or unreadable. */
  readonly marker: string;
  /** What the page held there. */
  readonly raw: string;
}

/** Exactly one of the four results ADR-0003 allows. */
export type ListParse = Success<ListReading> | Empty<ListEmptyReason> | Unrecognized;
export type DetailParse = Success<DetailReading> | Failure<DetailFailureCode> | Unrecognized;

export function success<T>(value: T): Success<T> {
  return { kind: "success", value };
}

export function empty<E extends string>(reason: E): Empty<E> {
  return { kind: "empty", reason };
}

export function failure<F extends string>(code: F, message = ""): Failure<F> {
  return { kind: "failure", code, message };
}

export function unrecognized(marker: string, raw = ""): Unrecognized {
  return { kind: "unrecognized", marker, raw };
}

export function isUnrecognized<T>(value: T | Unrecognized): value is Unrecognized {
  return (
    typeof value === "object" && value !== null && "kind" in value && value.kind === "unrecognized"
  );
}
