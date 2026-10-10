/** Serving galleries toplists whole (ADR-0010; domain-model.md I8; nfr.md H2, H5, REL-3). */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { CatalogSize } from "../../mock/catalog";
import { RetryAfterSeconds } from "../../mock/faults";
import { startMock } from "../../mock/server";
import { mockEgress } from "../../src/egress/egress";
import type { UpstreamRequest } from "../../src/eh-core/upstream-request";
import { withNetworkRetries } from "../../src/governor/network-retries";
import { createPageLane, MockPagePacing } from "../../src/governor/page-lane";
import { openDatabase } from "../../src/store/database";
import { type ToplistSnapshotStore, toplistSnapshotStore } from "../../src/store/toplist-snapshots";
import { createToplistService, type ToplistAnswer } from "../../src/toplists/service";

const mock = startMock();
const lane = createPageLane(mockEgress(mock.url), MockPagePacing);
const background = withNetworkRetries(
  (request: UpstreamRequest) => lane.send(request, "background"),
  async () => {},
);
const Start = Date.parse("2026-10-11T00:00:00Z");
const Minute = 60_000;
const Day = 24 * 60 * Minute;

afterAll(() => mock.stop());

beforeEach(() => {
  mock.clearFaults();
  mock.clearRequests();
});

/** A service over a new database, on a clock that moves only when the test moves it. */
function setup(send = background, store: ToplistSnapshotStore = newStore()) {
  let time = Start;
  const service = createToplistService({ store, send, secondsPerPage: 4.5, now: () => time });
  return {
    service,
    store,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

function newStore(): ToplistSnapshotStore {
  return toplistSnapshotStore(openDatabase(":memory:"));
}

/** Each walk reads the second page between the first page and its rereads, so the list moves. */
async function recomputingAfterSecondPage(request: UpstreamRequest) {
  const response = await background(request);
  if (request.target.endsWith("&p=1")) {
    mock.recomputeToplists();
  }

  return response;
}

function observedAt(answer: ToplistAnswer): string | null {
  return answer.kind === "snapshot" ? answer.snapshot.observedAt.toISOString() : null;
}

describe("toplist service", () => {
  test("ADR-0010: the first request starts a walk and is told when to come back", async () => {
    const { service } = setup();

    expect(service.get("yesterday")).toEqual({
      kind: "pending",
      progress: null,
      retryAfterSeconds: Math.ceil(202 * 4.5),
    });
    await service.whenIdle();

    const answer = service.get("yesterday");
    expect(answer.kind).toBe("snapshot");
    expect(answer.kind === "snapshot" && answer.snapshot.entries.length).toBe(CatalogSize);
    expect(observedAt(answer)).toBe("2026-10-11T00:00:00.000Z");
  });

  test("ADR-0010: a fresh snapshot is served without reading the site", async () => {
    const { service } = setup();
    service.get("yesterday");
    await service.whenIdle();
    mock.clearRequests();

    service.get("yesterday");
    await service.whenIdle();

    expect(mock.requests()).toEqual([]);
  });

  test("ADR-0010: a stale snapshot is served at once and walked again", async () => {
    const { service, advance } = setup();
    service.get("yesterday");
    await service.whenIdle();
    advance(Day);

    expect(observedAt(service.get("yesterday"))).toBe("2026-10-11T00:00:00.000Z");
    await service.whenIdle();

    expect(observedAt(service.get("yesterday"))).toBe("2026-10-12T00:00:00.000Z");
  });

  test("ADR-0010: one walk at a time per toplist", async () => {
    const { service } = setup();

    service.get("yesterday");
    service.get("yesterday");
    await service.whenIdle();

    expect(mock.requests()).toHaveLength(4);
  });

  test("H5: a walk the list moved under waits 10 minutes, and an hour after three", async () => {
    const { service, advance } = setup(recomputingAfterSecondPage);

    service.get("yesterday");
    await service.whenIdle();
    expect(service.get("yesterday")).toEqual({
      kind: "pending",
      progress: null,
      retryAfterSeconds: 600,
    });

    for (const _again of [1, 2]) {
      advance(10 * Minute);
      service.get("yesterday");
      await service.whenIdle();
    }

    expect(service.get("yesterday")).toEqual({
      kind: "pending",
      progress: null,
      retryAfterSeconds: 3600,
    });
  });

  test("H5: a stopped walk breaks a run of moved ones", async () => {
    const { service, advance } = setup(recomputingAfterSecondPage);
    service.get("yesterday");
    await service.whenIdle();
    advance(10 * Minute);
    service.get("yesterday");
    await service.whenIdle();

    advance(10 * Minute);
    mock.addFault({ fault: "http_429", pathPrefix: "/toplist.php", times: 1 });
    service.get("yesterday");
    await service.whenIdle();
    advance(10 * Minute);
    service.get("yesterday");
    await service.whenIdle();

    expect(service.get("yesterday")).toEqual({
      kind: "pending",
      progress: null,
      retryAfterSeconds: 600,
    });
  });

  test("H2: a stopped walk waits for the outcome's cooldown, and at least 10 minutes", async () => {
    mock.addFault({ fault: "http_429", pathPrefix: "/toplist.php", times: 1 });
    const limited = setup();
    limited.service.get("yesterday");
    await limited.service.whenIdle();

    mock.addFault({ fault: "cloudflare_403", pathPrefix: "/toplist.php", times: 1 });
    const challenged = setup();
    challenged.service.get("yesterday");
    await challenged.service.whenIdle();
    mock.clearRequests();

    expect(limited.service.get("yesterday")).toMatchObject({
      kind: "stopped",
      stop: { kind: "failure", code: "upstream_rate_limited" },
      retryAfterSeconds: Math.max(600, RetryAfterSeconds),
    });
    expect(challenged.service.get("yesterday")).toMatchObject({
      kind: "stopped",
      stop: { kind: "failure", code: "cloudflare_challenge" },
      retryAfterSeconds: 1800,
    });
    expect(mock.requests()).toEqual([]);
  });

  test("H2: a failed refresh leaves the stale snapshot served, and waits before trying again", async () => {
    const { service, advance } = setup();
    service.get("yesterday");
    await service.whenIdle();
    advance(Day);
    mock.addFault({ fault: "http_429", pathPrefix: "/toplist.php", times: 1 });

    service.get("yesterday");
    await service.whenIdle();
    mock.clearRequests();

    expect(observedAt(service.get("yesterday"))).toBe("2026-10-11T00:00:00.000Z");
    expect(mock.requests()).toEqual([]);
  });

  test("a page that does not answer is tried twice more before the walk stops", async () => {
    mock.addFault({ fault: "connection_reset", pathPrefix: "/toplist.php", times: 2 });
    const recovered = setup();
    recovered.service.get("yesterday");
    await recovered.service.whenIdle();

    mock.addFault({ fault: "connection_reset", pathPrefix: "/toplist.php", times: 3 });
    const stopped = setup();
    stopped.service.get("yesterday");
    await stopped.service.whenIdle();

    expect(recovered.service.get("yesterday").kind).toBe("snapshot");
    expect(stopped.service.get("yesterday")).toMatchObject({
      kind: "stopped",
      stop: { kind: "network" },
      retryAfterSeconds: 600,
    });
  });

  test("REL-3, I8: a snapshot outlives the service that made it", async () => {
    const store = newStore();
    const first = setup(background, store);
    first.service.get("yesterday");
    await first.service.whenIdle();
    mock.clearRequests();

    const restarted = setup(background, store);

    expect(restarted.service.get("yesterday").kind).toBe("snapshot");
    expect(mock.requests()).toEqual([]);
  });
});
