/** Walking a galleries toplist against the mock (ADR-0010; nfr.md H5, PERF-4, REL-1). */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { CatalogSize, toplistGids } from "../../mock/catalog";
import { RetryAfterSeconds } from "../../mock/faults";
import { startMock } from "../../mock/server";
import { EgressUnavailableError, mockEgress } from "../../src/egress/egress";
import type { UpstreamRequest } from "../../src/eh-core/upstream-request";
import { createPageLane, MockPagePacing, type PageAnswer } from "../../src/governor/page-lane";
import { openDatabase } from "../../src/store/database";
import { egressStateStore } from "../../src/store/egress-states";
import { type WalkProgress, walkGalleryToplist } from "../../src/toplists/walk";

const mock = startMock();
const YesterdayCode = 15;

/** Background page loads on a lane of their own, so no cooldown outlives its test. */
function newSend(): (request: UpstreamRequest) => Promise<PageAnswer> {
  const lane = createPageLane(
    mockEgress(mock.url),
    MockPagePacing,
    egressStateStore(openDatabase(":memory:")),
  );
  return (request) => lane.send(request, "background");
}

afterAll(() => mock.stop());

beforeEach(() => {
  mock.clearFaults();
  mock.clearRequests();
});

describe("walkGalleryToplist", () => {
  test("H5: reads the whole toplist in rank order", async () => {
    const observedAt = new Date("2026-10-11T12:00:00Z");

    const walk = await walkGalleryToplist("yesterday", newSend(), { now: () => observedAt });

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

    await walkGalleryToplist("yesterday", newSend(), { onProgress: (step) => progress.push(step) });

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
    const send = newSend();
    let pageLoads = 0;
    const recomputingAfterTwo = async (request: UpstreamRequest) => {
      const answer = await send(request);
      if (++pageLoads === 2) {
        mock.recomputeToplists();
      }

      return answer;
    };

    const walk = await walkGalleryToplist("yesterday", recomputingAfterTwo);

    expect(walk).toEqual({ kind: "moved", reason: "page 0 changed" });
  });

  test("REL-1: a rate limit stops the walk with the site's outcome", async () => {
    mock.addFault({ fault: "http_429", pathPrefix: "/toplist.php", times: 1 });

    expect(await walkGalleryToplist("yesterday", newSend())).toEqual({
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

    expect(await walkGalleryToplist("yesterday", newSend())).toMatchObject({
      kind: "stopped",
      stop: { kind: "unrecognized", marker: "h1.ih a[href]" },
    });
  });

  test("REL-1: a broken transfer stops the walk as a network failure", async () => {
    mock.addFault({ fault: "connection_reset", pathPrefix: "/toplist.php", times: 1 });

    expect(await walkGalleryToplist("yesterday", newSend())).toMatchObject({
      kind: "stopped",
      stop: { kind: "network" },
    });
  });

  test("H7: an egress that cannot be used stops the walk as egress_unavailable", async () => {
    const unavailable = async (): Promise<PageAnswer> => {
      throw new EgressUnavailableError("proxy vps does not accept connections");
    };

    expect(await walkGalleryToplist("yesterday", unavailable)).toEqual({
      kind: "stopped",
      stop: { kind: "egress_unavailable", message: "proxy vps does not accept connections" },
    });
  });

  test("H2: after a rate limit, the next walk stops before any page is sent", async () => {
    const send = newSend();
    mock.addFault({ fault: "http_429", pathPrefix: "/toplist.php", times: 1 });
    await walkGalleryToplist("yesterday", send);
    mock.clearRequests();

    const walk = await walkGalleryToplist("pastMonth", send);

    expect(walk).toMatchObject({
      kind: "stopped",
      stop: { kind: "refused", reason: "upstream_rate_limited" },
    });
    expect(mock.requests()).toEqual([]);
  });
});
