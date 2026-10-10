/** Walking a galleries toplist against the mock (ADR-0010; nfr.md H5, PERF-4, REL-1). */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { CatalogSize, toplistGids } from "../../mock/catalog";
import { RetryAfterSeconds } from "../../mock/faults";
import { startMock } from "../../mock/server";
import { mockEgress } from "../../src/egress/egress";
import type { UpstreamRequest } from "../../src/eh-core/upstream-request";
import { createPageLane, MockPagePacing } from "../../src/governor/page-lane";
import { type WalkProgress, walkGalleryToplist } from "../../src/toplists/walk";

const mock = startMock();
const lane = createPageLane(mockEgress(mock.url), MockPagePacing);
const send = (request: UpstreamRequest) => lane.send(request, "background");
const YesterdayCode = 15;

afterAll(() => mock.stop());

beforeEach(() => {
  mock.clearFaults();
  mock.clearRequests();
});

describe("walkGalleryToplist", () => {
  test("H5: reads the whole toplist in rank order", async () => {
    const observedAt = new Date("2026-10-11T12:00:00Z");

    const walk = await walkGalleryToplist("yesterday", send, { now: () => observedAt });

    expect(walk.kind).toBe("complete");
    if (walk.kind === "complete") {
      expect(walk.entries.map((entry) => entry.rank)).toEqual(
        Array.from({ length: CatalogSize }, (_, index) => index + 1),
      );
      expect(walk.entries.map((entry) => entry.gallery.gid)).toEqual(toplistGids(YesterdayCode, 0));
      expect(walk.observedAt).toEqual(observedAt);
    }
  });

  test("PERF-4: costs the page count plus two page loads, the first and last page twice", async () => {
    const progress: WalkProgress[] = [];

    await walkGalleryToplist("yesterday", send, { onProgress: (step) => progress.push(step) });

    expect(mock.requests().map((request) => request.query)).toEqual([
      "?tl=15",
      "?tl=15&p=1",
      "?tl=15",
      "?tl=15&p=1",
    ]);
    expect(progress).toEqual([
      { pagesDone: 1, pagesTotal: 4 },
      { pagesDone: 2, pagesTotal: 4 },
      { pagesDone: 3, pagesTotal: 4 },
      { pagesDone: 4, pagesTotal: 4 },
    ]);
  });

  test("H5: a recomputation during the walk discards it", async () => {
    let pageLoads = 0;
    const recomputingAfterTwo = async (request: UpstreamRequest) => {
      const response = await send(request);
      if (++pageLoads === 2) {
        mock.recomputeToplists();
      }

      return response;
    };

    const walk = await walkGalleryToplist("yesterday", recomputingAfterTwo);

    expect(walk).toEqual({ kind: "moved", reason: "page 0 changed" });
  });

  test("REL-1: a rate limit stops the walk with the site's outcome", async () => {
    mock.addFault({ fault: "http_429", pathPrefix: "/toplist.php", times: 1 });

    expect(await walkGalleryToplist("yesterday", send)).toEqual({
      kind: "stopped",
      stop: {
        kind: "failure",
        code: "upstream_rate_limited",
        message: "",
        retryAfterSeconds: RetryAfterSeconds,
      },
    });
  });

  test("REL-1: a page the parser does not know stops the walk as unrecognized", async () => {
    mock.addFault({ fault: "error_box", pathPrefix: "/toplist.php", times: 1 });

    expect(await walkGalleryToplist("yesterday", send)).toMatchObject({
      kind: "stopped",
      stop: { kind: "unrecognized", marker: "h1.ih a[href]" },
    });
  });

  test("REL-1: a broken transfer stops the walk as a network failure", async () => {
    mock.addFault({ fault: "connection_reset", pathPrefix: "/toplist.php", times: 1 });

    expect(await walkGalleryToplist("yesterday", send)).toMatchObject({
      kind: "stopped",
      stop: { kind: "network" },
    });
  });
});
