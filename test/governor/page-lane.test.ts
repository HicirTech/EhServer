/**
 * The governor's page lane (ADR-0005 page class; ADR-0010 background priority; nfr.md SITE-1, H2,
 * REL-3, TEST-1).
 */
import { describe, expect, test } from "bun:test";

import { type FaultName, faultResponse, isFaultName, RetryAfterSeconds } from "../../mock/faults";
import type { OutcomeCode } from "../../src/domain/outcomes";
import type { Egress } from "../../src/egress/egress";
import type { UpstreamResponse } from "../../src/eh-core/envelope";
import type { UpstreamRequest } from "../../src/eh-core/upstream-request";
import { type Clock, createPageLane, SitePagePacing } from "../../src/governor/page-lane";
import { openDatabase } from "../../src/store/database";
import { type EgressStateStore, egressStateStore } from "../../src/store/egress-states";

const Minute = 60_000;
const Hour = 60 * Minute;

/** Time moves only when the lane sleeps or the test lets it pass, so every start time is exact. */
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

/**
 * An egress that records when each page started and answers when the test lets it. A page named
 * after a mock fault, such as `/http_429`, gets that fault's answer.
 */
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
      const fault = request.target.slice(1);
      return isFaultName(fault)
        ? faultAnswer(fault, request)
        : { site: request.site, status: 200, headers: new Headers(), body: request.target };
    },
  };
  return { egress, started, held, mostActive: () => mostActive };
}

async function faultAnswer(fault: FaultName, request: UpstreamRequest): Promise<UpstreamResponse> {
  const answer = await faultResponse(fault, new Request(`http://mock${request.target}`));
  return {
    site: request.site,
    status: answer.status,
    headers: answer.headers,
    body: await answer.text(),
  };
}

const page = (target: string): UpstreamRequest => ({ site: "eh", target });

function newStates(): EgressStateStore {
  return egressStateStore(openDatabase(":memory:"));
}

describe("page lane", () => {
  test("SITE-1: page loads start one gap apart, the gap drawn between 3 and 6 s", async () => {
    const clock = virtualClock();
    const draws = [0, 1, 0.5];
    const { egress, started } = recordingEgress(clock);
    const lane = createPageLane(
      egress,
      SitePagePacing,
      newStates(),
      clock,
      () => draws.shift() ?? 0,
    );

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
    const lane = createPageLane(egress, SitePagePacing, newStates(), clock, () => 0);

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
    const lane = createPageLane(egress, SitePagePacing, newStates(), clock, () => 0);

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
    const lane = createPageLane(egress, SitePagePacing, newStates(), clock, () => 0);

    const failed = lane.send(page("/fail"), "background");
    const next = lane.send(page("/next"), "background");

    await expect(failed).rejects.toThrow("connection reset");
    expect(await next).toMatchObject({ kind: "answered", response: { body: "/next" } });
  });

  test.each<[fault: FaultName, reason: OutcomeCode, cooldownMs: number]>([
    ["http_429", "upstream_rate_limited", RetryAfterSeconds * 1000],
    ["cloudflare_403", "cloudflare_challenge", 30 * Minute],
    ["backend_fetch_failed", "upstream_unavailable", Minute],
    ["ban_text", "ip_banned", (59 * Minute + 48_000) * 1.1],
    ["too_fast_text", "too_fast_warning", 15 * Minute],
  ])(
    "TEST-1, H2: after %s nothing is sent until the cooldown ends",
    async (fault, reason, cooldownMs) => {
      const clock = virtualClock();
      const { egress, started } = recordingEgress(clock);
      const lane = createPageLane(egress, SitePagePacing, newStates(), clock, () => 0);

      await lane.send(page(`/${fault}`), "background");
      const refused = await lane.send(page("/during"), "foreground");
      await clock.sleep(cooldownMs);
      const sent = await lane.send(page("/after"), "background");

      expect(refused).toEqual({ kind: "refused", reason, until: new Date(cooldownMs) });
      expect(sent.kind).toBe("answered");
      expect(started.map((entry) => entry.target)).toEqual([`/${fault}`, "/after"]);
    },
  );

  test("H2: pages waiting when a cooldown starts are refused, not sent", async () => {
    const clock = virtualClock();
    const { egress, started } = recordingEgress(clock);
    const lane = createPageLane(egress, SitePagePacing, newStates(), clock, () => 0);

    const limited = lane.send(page("/http_429"), "background");
    const waiting = [
      lane.send(page("/walk"), "background"),
      lane.send(page("/client"), "foreground"),
    ];
    await limited;

    expect((await Promise.all(waiting)).map((answer) => answer.kind)).toEqual([
      "refused",
      "refused",
    ]);
    expect(started.map((entry) => entry.target)).toEqual(["/http_429"]);
  });

  test("an outcome that concerns one account rests nothing", async () => {
    const clock = virtualClock();
    const { egress } = recordingEgress(clock);
    const lane = createPageLane(egress, SitePagePacing, newStates(), clock, () => 0);

    await lane.send(page("/sad_panda"), "background");

    expect((await lane.send(page("/next"), "background")).kind).toBe("answered");
  });

  test("REL-3: a lane over the stored state keeps the cooldown", async () => {
    const clock = virtualClock();
    const states = newStates();
    const limited = createPageLane(recordingEgress(clock).egress, SitePagePacing, states, clock);
    await limited.send(page("/http_429"), "background");
    const { egress, started } = recordingEgress(clock);
    const restarted = createPageLane(egress, SitePagePacing, states, clock);

    const refused = await restarted.send(page("/during"), "background");

    expect(refused).toEqual({
      kind: "refused",
      reason: "upstream_rate_limited",
      until: new Date(RetryAfterSeconds * 1000),
    });
    expect(started).toEqual([]);
  });

  test("H2: after the too-fast warning's cooldown, pages start twice as far apart for 24 h", async () => {
    const clock = virtualClock();
    const { egress, started } = recordingEgress(clock);
    const lane = createPageLane(egress, SitePagePacing, newStates(), clock, () => 0);

    await lane.send(page("/too_fast_text"), "background");
    await clock.sleep(15 * Minute);
    await Promise.all(["/a", "/b"].map((target) => lane.send(page(target), "background")));
    await clock.sleep(24 * Hour);
    await Promise.all(["/c", "/d"].map((target) => lane.send(page(target), "background")));

    expect(started.slice(1)).toEqual([
      { target: "/a", at: 15 * Minute },
      { target: "/b", at: 15 * Minute + 6_000 },
      { target: "/c", at: 24 * Hour + 15 * Minute + 6_000 },
      { target: "/d", at: 24 * Hour + 15 * Minute + 9_000 },
    ]);
  });

  test("REL-3: a lane over the stored state keeps the halved rate", async () => {
    const clock = virtualClock();
    const states = newStates();
    const warned = createPageLane(
      recordingEgress(clock).egress,
      SitePagePacing,
      states,
      clock,
      () => 0,
    );
    await warned.send(page("/too_fast_text"), "background");
    await clock.sleep(15 * Minute);
    const { egress, started } = recordingEgress(clock);
    const restarted = createPageLane(egress, SitePagePacing, states, clock, () => 0);

    await Promise.all(["/a", "/b"].map((target) => restarted.send(page(target), "background")));

    expect(started).toEqual([
      { target: "/a", at: 15 * Minute },
      { target: "/b", at: 15 * Minute + 6_000 },
    ]);
  });
});
