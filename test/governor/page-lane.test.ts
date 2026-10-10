/** The governor's page lane (ADR-0005 page class; ADR-0010 background priority; nfr.md SITE-1). */
import { describe, expect, test } from "bun:test";

import type { Egress } from "../../src/egress/egress";
import type { UpstreamResponse } from "../../src/eh-core/envelope";
import type { UpstreamRequest } from "../../src/eh-core/upstream-request";
import { type Clock, createPageLane, SitePagePacing } from "../../src/governor/page-lane";

/** Time moves only when the lane sleeps, so every start time is exact. */
function virtualClock(): Clock {
  let now = 0;
  return {
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
  };
}

interface Started {
  readonly target: string;
  readonly at: number;
}

/** An egress that records when each page started and answers when the test lets it. */
function recordingEgress(clock: Clock) {
  const started: Started[] = [];
  const held = new Map<string, () => void>();
  let active = 0;
  let mostActive = 0;
  const egress: Egress = {
    id: "test",
    profile: "mock",
    send: async (request: UpstreamRequest): Promise<UpstreamResponse> => {
      started.push({ target: request.target, at: clock.now() });
      active++;
      mostActive = Math.max(mostActive, active);
      if (request.target.startsWith("/hold")) {
        await new Promise<void>((release) => held.set(request.target, release));
      }

      if (request.target.startsWith("/fail")) {
        active--;
        throw new Error("connection reset");
      }

      active--;
      return { site: request.site, status: 200, headers: new Headers(), body: request.target };
    },
  };
  return { egress, started, held, mostActive: () => mostActive };
}

const page = (target: string): UpstreamRequest => ({ site: "eh", target });

describe("page lane", () => {
  test("SITE-1: page loads start one gap apart, the gap drawn between 3 and 6 s", async () => {
    const clock = virtualClock();
    const draws = [0, 1, 0.5];
    const { egress, started } = recordingEgress(clock);
    const lane = createPageLane(egress, SitePagePacing, clock, () => draws.shift() ?? 0);

    await Promise.all(["/a", "/b", "/c"].map((target) => lane.send(page(target), "background")));

    expect(started).toEqual([
      { target: "/a", at: 0 },
      { target: "/b", at: 3_000 },
      { target: "/c", at: 9_000 },
    ]);
  });

  test("SITE-1: page loads never overlap", async () => {
    const clock = virtualClock();
    const { egress, held, mostActive } = recordingEgress(clock);
    const lane = createPageLane(egress, SitePagePacing, clock, () => 0);

    const first = lane.send(page("/hold-1"), "background");
    const second = lane.send(page("/b"), "background");
    await Bun.sleep(0);
    held.get("/hold-1")?.();
    await Promise.all([first, second]);

    expect(mostActive()).toBe(1);
  });

  test("ADR-0010: a client's page goes before a walk's waiting pages", async () => {
    const clock = virtualClock();
    const { egress, started, held } = recordingEgress(clock);
    const lane = createPageLane(egress, SitePagePacing, clock, () => 0);

    const walkFirst = lane.send(page("/hold-walk-1"), "background");
    await Bun.sleep(0);
    const walkSecond = lane.send(page("/walk-2"), "background");
    const client = lane.send(page("/client"), "foreground");
    held.get("/hold-walk-1")?.();
    await Promise.all([walkFirst, walkSecond, client]);

    expect(started.map((entry) => entry.target)).toEqual(["/hold-walk-1", "/client", "/walk-2"]);
  });

  test("a transport error reaches its caller, and the lane goes on", async () => {
    const clock = virtualClock();
    const { egress } = recordingEgress(clock);
    const lane = createPageLane(egress, SitePagePacing, clock, () => 0);

    const failed = lane.send(page("/fail"), "background");
    const next = lane.send(page("/next"), "background");

    await expect(failed).rejects.toThrow("connection reset");
    expect((await next).body).toBe("/next");
  });
});
