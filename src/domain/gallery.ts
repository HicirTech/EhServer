/** Value types of the domain model (docs/domain-model.md) that more than one module uses. */

/** Closed: a category E-Hentai does not have makes the response unrecognized. */
export const Categories = [
  "doujinshi",
  "manga",
  "artistCg",
  "gameCg",
  "western",
  "nonH",
  "imageSet",
  "cosplay",
  "asianPorn",
  "misc",
] as const;

export type Category = (typeof Categories)[number];

/** The token is an access key for upstream requests, not part of the identity. */
export interface GalleryRef {
  readonly gid: number;
  readonly token: string;
}

/** A page of a gallery. Page numbers start at 1; the page token is the page's upstream access key. */
export interface PageRef {
  readonly gid: number;
  readonly number: number;
  readonly pageToken: string;
}

/** Namespaces are open: E-Hentai adds them. */
export interface Tag {
  readonly namespace: string;
  readonly name: string;
}
