import { type DetailPage, detailComment, detailPage } from "../fixtures/eh/detail-page";
import { type GalleryRow, galleryRow } from "../fixtures/eh/list-page";
import type { Site } from "../fixtures/eh/page-shell";

/** The mock serves galleries 9000001 to 9000060; the newest has the highest gid. */
export const FirstGid = 9000001;
export const CatalogSize = 60;
export const ListPageSize = 25;
export const PreviewsPerPage = 20;

const Categories = [
  "Doujinshi",
  "Manga",
  "Artist CG",
  "Game CG",
  "Western",
  "Non-H",
  "Image Set",
  "Cosplay",
  "Asian Porn",
  "Misc",
];

const HourMs = 60 * 60 * 1000;
const NewestPostedMs = Date.UTC(2026, 8, 30, 12, 0);

interface Gallery {
  readonly gid: number;
  readonly token: string;
  readonly title: string;
  readonly category: string;
  readonly posted: string;
  readonly pages: number;
  readonly uploader: string;
  readonly tags: readonly { readonly namespace: string; readonly names: readonly string[] }[];
}

/** Every gid in the catalogue, newest first. */
export function catalogGids(): number[] {
  return Array.from({ length: CatalogSize }, (_, index) => FirstGid + CatalogSize - 1 - index);
}

export function isCatalogGid(gid: number): boolean {
  return Number.isInteger(gid) && gid >= FirstGid && gid < FirstGid + CatalogSize;
}

export function galleryToken(gid: number): string {
  return sha1Hex(`token:${gid}`).slice(0, 10);
}

export function pageToken(gid: number, page: number): string {
  return sha1Hex(`page:${gid}:${page}`).slice(0, 10);
}

/** The whole search text is one phrase, looked for in the title and in each tag. */
export function matchesSearch(gid: number, search: string): boolean {
  const gallery = catalogGallery(gid);
  const phrase = search.trim().toLowerCase();
  const texts = [gallery.title, ...gallery.tags.flatMap((group) => group.names)];
  return texts.some((text) => text.toLowerCase().includes(phrase));
}

export function listRow(gid: number): GalleryRow {
  const gallery = catalogGallery(gid);
  return galleryRow({
    gid,
    token: gallery.token,
    title: gallery.title,
    category: gallery.category,
    posted: gallery.posted,
    pages: gallery.pages,
    uploader: gallery.uploader,
    tags: gallery.tags.flatMap((group) => group.names.map((name) => `${group.namespace}:${name}`)),
  });
}

/** The gallery page that shows previews page `previewPage`, counted from 0 as the site does. */
export function galleryPage(site: Site, gid: number, previewPage: number): DetailPage | null {
  const gallery = catalogGallery(gid);
  const start = previewPage * PreviewsPerPage + 1;
  if (!Number.isInteger(previewPage) || previewPage < 0 || start > gallery.pages) {
    return null;
  }

  const count = Math.min(PreviewsPerPage, gallery.pages - start + 1);
  return detailPage({
    site,
    gid,
    token: gallery.token,
    title: gallery.title,
    titleJpn: "",
    category: gallery.category,
    uploader: gallery.uploader,
    posted: gallery.posted,
    parent: null,
    length: gallery.pages,
    tags: gallery.tags,
    previewStart: start,
    previewPageTokens: Array.from({ length: count }, (_, index) => pageToken(gid, start + index)),
    comments: [detailComment({ id: 0, author: gallery.uploader }), detailComment()],
  });
}

function catalogGallery(gid: number): Gallery {
  const number = gid - FirstGid + 1;
  return {
    gid,
    token: galleryToken(gid),
    title: `[Synthetic Circle ${number % 7}] Synthetic Gallery ${number} [English]`,
    category: Categories[number % Categories.length] ?? "Misc",
    posted: siteTime(NewestPostedMs - (CatalogSize - number) * HourMs),
    pages: 10 + (number % 30),
    uploader: `synthetic uploader ${number % 4}`,
    tags: [
      { namespace: "language", names: ["english"] },
      { namespace: "female", names: [`synthetic tag ${number % 5}`] },
      { namespace: "artist", names: [`synthetic artist ${number % 3}`] },
    ],
  };
}

/** The site prints UTC as `yyyy-MM-dd HH:mm`. */
function siteTime(ms: number): string {
  return new Date(ms).toISOString().slice(0, 16).replace("T", " ");
}

function sha1Hex(text: string): string {
  return new Bun.CryptoHasher("sha1").update(text).digest("hex");
}
