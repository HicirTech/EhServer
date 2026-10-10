/** A toplist read whole (ADR-0010; nfr.md H5: no partial or mixed list is ever returned). */
import { describe, expect, test } from "bun:test";

import { galleryRow } from "../../fixtures/eh/list-page";
import { galleryToplistPageHtml, toplistRow } from "../../fixtures/eh/toplist-page";
import {
  type GalleryToplistReading,
  parseGalleryToplistPage,
} from "../../src/eh-core/toplist-page";
import { assembleToplistWalk } from "../../src/eh-core/toplist-walk";

const PerPage = 2;

function toplistPages(pageCount: number): GalleryToplistReading[] {
  return Array.from({ length: pageCount }, (_, page) => ({
    page,
    pageCount,
    entries: Array.from({ length: PerPage }, (_, index) => {
      const rank = page * PerPage + index + 1;
      return { rank, score: 10_000 - rank, gallery: { gid: 9000000 + rank, token: "a1b2c3d4e5" } };
    }),
  }));
}

function pageOf(pages: readonly GalleryToplistReading[], index: number): GalleryToplistReading {
  const page = pages.at(index);
  if (page === undefined) {
    throw new Error(`no page ${index}`);
  }

  return page;
}

function recheckOf(pages: readonly GalleryToplistReading[]) {
  return { first: pageOf(pages, 0), last: pageOf(pages, -1) };
}

describe("assembleToplistWalk", () => {
  test("H5: pages that fit together and did not move make the whole toplist", () => {
    const pages = toplistPages(3);

    const walk = assembleToplistWalk(pages, recheckOf(pages));

    expect(walk.kind).toBe("complete");
    expect(walk.kind === "complete" && walk.entries.map((entry) => entry.rank)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  test("H5: pages as the toplist parser reads them make the whole toplist", () => {
    const pages = [0, 1, 2].map((page) => {
      const html = galleryToplistPageHtml({
        page,
        pageCount: 3,
        rows: [1, 2].map((offset) => {
          const rank = page * PerPage + offset;
          return toplistRow({ gallery: galleryRow({ gid: 9000000 + rank }), rank });
        }),
      });
      const result = parseGalleryToplistPage(html, "yesterday");
      if (result.kind !== "success") {
        throw new Error(`expected a reading, got ${JSON.stringify(result)}`);
      }

      return result.value;
    });

    expect(assembleToplistWalk(pages, recheckOf(pages))).toMatchObject({ kind: "complete" });
  });

  test("H5: a toplist of one page is its own first and last page", () => {
    const pages = toplistPages(1);

    expect(assembleToplistWalk(pages, recheckOf(pages))).toMatchObject({ kind: "complete" });
  });

  test("H5: a missing page discards the walk", () => {
    const pages = toplistPages(3);
    const read = [pageOf(pages, 0), pageOf(pages, 2)];

    expect(assembleToplistWalk(read, recheckOf(pages))).toEqual({
      kind: "moved",
      reason: "pages 0/3 2/3",
    });
  });

  test("H5: a page count that changes during the walk discards it", () => {
    const pages = toplistPages(3);
    const read = pages.map((page) => (page.page === 1 ? { ...page, pageCount: 4 } : page));

    expect(assembleToplistWalk(read, recheckOf(pages))).toEqual({
      kind: "moved",
      reason: "pages 0/3 1/4 2/3",
    });
  });

  test("H5: a gap in the ranks between pages discards the walk", () => {
    const pages = toplistPages(3);
    const second = pageOf(pages, 1);
    const read = pages.map((page) =>
      page === second
        ? { ...page, entries: page.entries.map((entry) => ({ ...entry, rank: entry.rank + 1 })) }
        : page,
    );

    expect(assembleToplistWalk(read, recheckOf(pages))).toEqual({
      kind: "moved",
      reason: "rank 4 at entry 3",
    });
  });

  test("H5: a gallery that appears twice discards the walk", () => {
    const pages = toplistPages(3);
    const repeated = pageOf(pages, 0).entries[0]?.gallery;
    const read = pages.map((page) =>
      page.page === 2
        ? {
            ...page,
            entries: page.entries.map((entry, index) =>
              index === 0 && repeated !== undefined ? { ...entry, gallery: repeated } : entry,
            ),
          }
        : page,
    );

    expect(assembleToplistWalk(read, recheckOf(read))).toEqual({
      kind: "moved",
      reason: "gallery 9000001 twice",
    });
  });

  test("H5: a first page that changed by the end of the walk discards it", () => {
    const pages = toplistPages(3);
    const first = pageOf(pages, 0);
    const changed = {
      ...first,
      entries: first.entries.map((entry) => ({ ...entry, score: entry.score + 1 })),
    };

    expect(assembleToplistWalk(pages, { first: changed, last: pageOf(pages, -1) })).toEqual({
      kind: "moved",
      reason: "page 0 changed",
    });
  });

  test("H5: a last page that changed by the end of the walk discards it", () => {
    const pages = toplistPages(3);
    const last = pageOf(pages, -1);
    const changed = { ...last, entries: [...last.entries].reverse() };

    expect(assembleToplistWalk(pages, { first: pageOf(pages, 0), last: changed })).toEqual({
      kind: "moved",
      reason: "page 2 changed",
    });
  });

  test("H5: reading another page again than the first one discards the walk", () => {
    const pages = toplistPages(3);

    expect(
      assembleToplistWalk(pages, { first: pageOf(pages, 1), last: pageOf(pages, -1) }),
    ).toEqual({ kind: "moved", reason: "page 1 changed" });
  });

  test("H5: a walk without pages is never complete", () => {
    const pages = toplistPages(1);

    expect(assembleToplistWalk([], recheckOf(pages))).toEqual({
      kind: "moved",
      reason: "page 0 changed",
    });
  });
});
