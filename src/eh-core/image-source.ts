/** Where a page's image is and what its bytes must be, as a single page or `showpage` gives it. */
import { attribute, type Element } from "./html";
import { need } from "./parse-result";

/** The file the image server will send, read from its address, so a download can be verified. */
export interface ImageFileKey {
  readonly sha1: string;
  readonly size: number;
  readonly width: number;
  readonly height: number;
  readonly format: string;
}

export interface ImageSource {
  /** The upstream address; it stays inside eh-core and the server (docs/domain-model.md I5). */
  readonly url: string;
  readonly file: ImageFileKey;
  /** The `nl` key that asks the site for another image server. */
  readonly reloadKey: string;
  /** The "Download original" link; null when the page offers none. */
  readonly originalUrl: string | null;
}

/** The site's image for "limit reached" (wiki: Limits-and-Anti-Crawling). */
const QuotaImage = /\/509s?\.gif$/;
/** H@H addresses name the file: `/h/<sha1>-<size>-<width>-<height>-<extension>/`. */
const FileKeyPattern = /\/h\/([0-9a-f]{40})-(\d+)-(\d+)-(\d+)-([a-z0-9]+)\//;
const ReloadKeyPattern = /\bnl\('([^']+)'\)/;

export function isQuotaImage(url: string | undefined): boolean {
  return url !== undefined && QuotaImage.test(url);
}

export function readImageSource(
  image: Element | null,
  reloadLink: Element | null,
  originalLinks: readonly Element[],
): ImageSource {
  const url = need(attribute(image, "src"), "#img[src]", "");
  const onclick = attribute(reloadLink, "onclick");
  const original = originalLinks[0];
  return {
    url,
    file: need(readFileKey(url), "#img[src]: file key", url),
    reloadKey: need(ReloadKeyPattern.exec(onclick ?? "")?.[1], "#loadfail[onclick]", onclick),
    originalUrl:
      original === undefined ? null : need(attribute(original, "href"), "fullimg a[href]", ""),
  };
}

function readFileKey(url: string): ImageFileKey | null {
  const match = FileKeyPattern.exec(url);
  if (match?.[1] === undefined || match[5] === undefined) {
    return null;
  }

  return {
    sha1: match[1],
    size: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4]),
    format: match[5],
  };
}
