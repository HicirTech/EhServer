/**
 * A toplist read whole (ADR-0010): every page in order, then the first and the last page again.
 * The pages make one list only if they fit together and nothing moved while they were read.
 */
import type { GalleryToplistReading, ToplistEntryReading } from "./toplist-page";

export type ToplistWalk =
  | { readonly kind: "complete"; readonly entries: readonly ToplistEntryReading[] }
  /** Discard the walk and read the toplist again later; `reason` names the check that failed. */
  | { readonly kind: "moved"; readonly reason: string };

/** The pages read again at the end of the walk. */
export interface ToplistRecheck {
  readonly first: GalleryToplistReading;
  readonly last: GalleryToplistReading;
}

export function assembleToplistWalk(
  pages: readonly GalleryToplistReading[],
  recheck: ToplistRecheck,
): ToplistWalk {
  const pageCount = pages[0]?.pageCount ?? 0;
  const isEveryPageInOrder =
    pages.length === pageCount &&
    pages.every((page, index) => page.page === index && page.pageCount === pageCount);
  if (!isEveryPageInOrder) {
    return moved(`pages ${pages.map((page) => `${page.page}/${page.pageCount}`).join(" ")}`);
  }

  const entries = pages.flatMap((page) => page.entries);
  const gap = entries.findIndex((entry, index) => entry.rank !== index + 1);
  if (gap >= 0) {
    return moved(`rank ${entries[gap]?.rank} at entry ${gap + 1}`);
  }

  const repeated = findRepeatedGallery(entries);
  if (repeated !== null) {
    return moved(`gallery ${repeated} twice`);
  }

  for (const [read, readAgain] of [
    [pages[0], recheck.first],
    [pages.at(-1), recheck.last],
  ] as const) {
    if (read === undefined || !isSameReading(read, readAgain)) {
      return moved(`page ${readAgain.page} changed`);
    }
  }

  return { kind: "complete", entries };
}

function moved(reason: string): ToplistWalk {
  return { kind: "moved", reason };
}

function findRepeatedGallery(entries: readonly ToplistEntryReading[]): number | null {
  const seen = new Set<number>();
  for (const { gallery } of entries) {
    if (seen.has(gallery.gid)) {
      return gallery.gid;
    }

    seen.add(gallery.gid);
  }

  return null;
}

function isSameReading(read: GalleryToplistReading, readAgain: GalleryToplistReading): boolean {
  return (
    read.page === readAgain.page &&
    read.pageCount === readAgain.pageCount &&
    read.entries.length === readAgain.entries.length &&
    read.entries.every((entry, index) => {
      const again = readAgain.entries[index];
      return (
        again !== undefined &&
        entry.rank === again.rank &&
        entry.score === again.score &&
        entry.gallery.gid === again.gallery.gid &&
        entry.gallery.token === again.gallery.token
      );
    })
  );
}
