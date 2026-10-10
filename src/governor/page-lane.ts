/**
 * Page loads on one egress (ADR-0005): one at a time, each starting a random 3 to 6 s after the
 * last one started. A waiting client's page goes before a waiting background walk (ADR-0010).
 */
import type { Egress } from "../egress/egress";
import type { UpstreamResponse } from "../eh-core/envelope";
import type { UpstreamRequest } from "../eh-core/upstream-request";

export type Priority = "foreground" | "background";

export interface Pacing {
  readonly minGapMs: number;
  readonly maxGapMs: number;
}

/** ADR-0005's built-in limit for the site; configuration may only lengthen it. */
export const SitePagePacing: Pacing = { minGapMs: 3_000, maxGapMs: 6_000 };
/** The mock is not the site, so nothing needs protecting. */
export const MockPagePacing: Pacing = { minGapMs: 0, maxGapMs: 0 };

export function averageGapSeconds(pacing: Pacing): number {
  return (pacing.minGapMs + pacing.maxGapMs) / 2 / 1000;
}

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const SystemClock: Clock = { now: () => Date.now(), sleep: (ms) => Bun.sleep(ms) };

/** A page that has not answered by then is a transport error (outcome `network`). */
const PageTimeoutMs = 30_000;

export interface PageLane {
  send(request: UpstreamRequest, priority: Priority): Promise<UpstreamResponse>;
}

interface Waiting {
  readonly request: UpstreamRequest;
  readonly resolve: (response: UpstreamResponse) => void;
  readonly reject: (error: unknown) => void;
}

export function createPageLane(
  egress: Egress,
  pacing: Pacing,
  clock: Clock = SystemClock,
  random: () => number = Math.random,
): PageLane {
  const queues: Record<Priority, Waiting[]> = { foreground: [], background: [] };
  let isRunning = false;
  let nextStartAt = 0;

  /** The priority is chosen when the gap is over, so a client arriving during it goes first. */
  async function run(): Promise<void> {
    isRunning = true;
    while (queues.foreground.length + queues.background.length > 0) {
      const wait = nextStartAt - clock.now();
      if (wait > 0) {
        await clock.sleep(wait);
      }

      const next = queues.foreground.shift() ?? queues.background.shift();
      if (next === undefined) {
        break;
      }

      nextStartAt = clock.now() + pacing.minGapMs + random() * (pacing.maxGapMs - pacing.minGapMs);
      try {
        next.resolve(await egress.send(next.request, AbortSignal.timeout(PageTimeoutMs)));
      } catch (error) {
        next.reject(error);
      }
    }

    isRunning = false;
  }

  return {
    send: (request, priority) =>
      new Promise((resolve, reject) => {
        queues[priority].push({ request, resolve, reject });
        if (!isRunning) {
          void run();
        }
      }),
  };
}
