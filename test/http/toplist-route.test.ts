/** `GET /api/v1/toplists/{type}` (ADR-0010; api/openapi.yaml getToplist; nfr.md H5). */
import { describe, expect, test } from "bun:test";

import type { ToplistPeriod } from "../../src/domain/toplist";
import { failure, unrecognized } from "../../src/eh-core/parse-result";
import { createApp } from "../../src/http/app";
import { toplistRoute } from "../../src/http/toplist-route";
import type { ToplistAnswer, ToplistService } from "../../src/toplists/service";

const RequestId = "req_test";

/** A service that gives one answer and records which periods it was asked for. */
function serving(answer: ToplistAnswer) {
  const asked: ToplistPeriod[] = [];
  const service: ToplistService = {
    get: (period) => {
      asked.push(period);
      return answer;
    },
    whenIdle: async () => {},
  };
  const app = createApp({
    routes: [toplistRoute(service)],
    onError: () => {},
    newRequestId: () => RequestId,
  });
  return {
    asked,
    get: (path: string) => app.fetch(new Request(`http://127.0.0.1/api/v1/toplists/${path}`)),
  };
}

const Snapshot: ToplistAnswer = {
  kind: "snapshot",
  snapshot: {
    period: "yesterday",
    observedAt: new Date("2026-10-11T08:00:00Z"),
    entries: [
      { rank: 1, score: 12_000, gallery: { gid: 9000002, token: "a1b2c3d4e5" } },
      { rank: 2, score: 11_000, gallery: { gid: 9000001, token: "0123456789" } },
    ],
  },
};

describe("toplist route", () => {
  test("ADR-0010: a snapshot is the whole toplist, with when it was read", async () => {
    const { get, asked } = serving(Snapshot);

    const response = await get("galleries?period=yesterday");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      type: "galleries",
      period: "yesterday",
      observedAt: "2026-10-11T08:00:00.000Z",
      entries: [
        { rank: 1, score: 12_000, gallery: { gid: 9000002, token: "a1b2c3d4e5" } },
        { rank: 2, score: 11_000, gallery: { gid: 9000001, token: "0123456789" } },
      ],
    });
    expect(asked).toEqual(["yesterday"]);
  });

  test("ADR-0010: a walk in progress answers 202 with its progress and Retry-After", async () => {
    const { get } = serving({
      kind: "pending",
      progress: { pagesDone: 40, pagesTotal: 202 },
      retryAfterSeconds: 729,
    });

    const response = await get("galleries?period=allTime");

    expect(response.status).toBe(202);
    expect(response.headers.get("Retry-After")).toBe("729");
    expect(await response.json()).toEqual({
      type: "galleries",
      period: "allTime",
      pagesDone: 40,
      pagesTotal: 202,
    });
  });

  test("ADR-0010: before the first page is read, no page total is given", async () => {
    const { get } = serving({ kind: "pending", progress: null, retryAfterSeconds: 909 });

    expect(await (await get("galleries?period=pastYear")).json()).toEqual({
      type: "galleries",
      period: "pastYear",
      pagesDone: 0,
    });
  });

  test("a stopped walk is the site's outcome as a problem, with when to try again", async () => {
    const { get } = serving({
      kind: "stopped",
      stop: failure("upstream_rate_limited", "", 120),
      retryAfterSeconds: 600,
    });

    const response = await get("galleries?period=yesterday");

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("600");
    expect(await response.json()).toMatchObject({
      code: "upstream_rate_limited",
      clientAction: "retry_after",
      retryAfter: 600,
      requestId: RequestId,
    });
  });

  test("H5: an unrecognized page is upstream_unrecognized, naming where, not what the page held", async () => {
    const { get } = serving({
      kind: "stopped",
      stop: unrecognized("h1.ih a[href]", "<html>page content</html>"),
      retryAfterSeconds: 600,
    });

    const response = await get("galleries?period=yesterday");
    const body = await response.text();

    expect(response.status).toBe(502);
    expect(JSON.parse(body)).toMatchObject({
      code: "upstream_unrecognized",
      detail: "a toplist page was not recognized at h1.ih a[href]",
    });
    expect(body).not.toContain("page content");
  });

  test("no answer from the site is the network outcome, without the transport's message", async () => {
    const { get } = serving({
      kind: "stopped",
      stop: { kind: "network", message: "Unable to connect to http://127.0.0.1:7878" },
      retryAfterSeconds: 600,
    });

    const body = await (await get("galleries?period=yesterday")).text();

    expect(JSON.parse(body)).toMatchObject({ code: "network", detail: "the site did not answer" });
    expect(body).not.toContain("127.0.0.1");
  });

  test.each([
    ["an unknown type", "favourites?period=yesterday", 400, "invalid_request"],
    ["a missing period", "galleries", 400, "invalid_request"],
    ["an unknown period", "galleries?period=lastWeek", 400, "invalid_request"],
    ["a type not served yet", "uploaders?period=yesterday", 501, "not_implemented"],
  ])("%s is refused without asking the service", async (_name, path, status, code) => {
    const { get, asked } = serving(Snapshot);

    const response = await get(path);

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code });
    expect(asked).toEqual([]);
  });
});
