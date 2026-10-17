/**
 * Page loads on one egress (ADR-0005): one at a time, each starting a random 3 to 6 s after the
 * last one started. A waiting client's page goes before a waiting background walk (ADR-0010).
 * An answer whose outcome rests the egress stops page loads until the cooldown ends; after the
 * too-fast warning they then run at half rate for 24 h. Both are stored, so a restart keeps them
 * (nfr.md H2, REL-3).
 */
import type { OutcomeCode } from "../domain/outcomes";
import type { Egress, EgressProfile } from "../egress/egress";
import { classifyEnvelope, type UpstreamResponse } from "../eh-core/envelope";
import type { UpstreamRequest } from "../eh-core/upstream-request";
import type { EgressStateStore } from "../store/egress-states";
import { pageCooldownMs, pageSlowdownMs } from "./page-cooldowns";

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

export function pagePacingFor(profile: EgressProfile): Pacing {
  return profile === "mock" ? MockPagePacing : SitePagePacing;
}

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const SystemClock: Clock = { now: () => Date.now(), sleep: (ms) => Bun.sleep(ms) };

/** A page that has not answered by then is a transport error (outcome `network`). */
const PageTimeoutMs = 30_000;
/** Half the page rate is twice the gap. */
const SlowedGapFactor = 2;

/** outcomes.md `egress_cooldown`: the page was not sent, because the egress rests until `until`. */
export interface Refusal {
  readonly kind: "refused";
  /** The outcome that started the cooldown. */
  readonly reason: OutcomeCode;
  readonly until: Date;
}

export type PageAnswer =
  | { readonly kind: "answered"; readonly response: UpstreamResponse }
  | Refusal;

export interface PageLane {
  /** Rejects only for a transport error; an answer of any status, and a refusal, resolve. */
  send(request: UpstreamRequest, priority: Priority): Promise<PageAnswer>;
  /** The average time from one page load's start to the next, at the lane's pace now. */
  secondsPerPage(): number;
}

interface Waiting {
  readonly request: UpstreamRequest;
  readonly resolve: (answer: PageAnswer) => void;
  readonly reject: (error: unknown) => void;
}

export function createPageLane(
  egress: Egress,
  pacing: Pacing,
  states: EgressStateStore,
  clock: Clock = SystemClock,
  random: () => number = Math.random,
): PageLane {
  const queues: Record<Priority, Waiting[]> = { foreground: [], background: [] };
  let state = states.get(egress.id);
  let isRunning = false;
  let nextStartAt = 0;

  /**
   * The priority is chosen when the gap is over, so a client arriving during it goes first. No
   * cooldown can start during the gap: nothing is in flight then.
   */
  async function run(): Promise<void> {
    isRunning = true;
    while (queues.foreground.length + queues.background.length > 0) {
      const refusal = refusalNow();
      if (refusal !== null) {
        refuseWaiting(refusal);
        break;
      }

      const wait = nextStartAt - clock.now();
      if (wait > 0) {
        await clock.sleep(wait);
      }

      const next = queues.foreground.shift() ?? queues.background.shift();
      if (next === undefined) {
        break;
      }

      nextStartAt = clock.now() + gapMs();
      try {
        const response = await egress.send(next.request, AbortSignal.timeout(PageTimeoutMs));
        noteOutcome(response);
        next.resolve({ kind: "answered", response });
      } catch (error) {
        next.reject(error);
      }
    }

    isRunning = false;
  }

  function refusalNow(): Refusal | null {
    if (state === null || state.cooldownUntil.getTime() <= clock.now()) {
      return null;
    }

    return { kind: "refused", reason: state.reason, until: state.cooldownUntil };
  }

  function refuseWaiting(refusal: Refusal): void {
    for (const waiting of [...queues.foreground.splice(0), ...queues.background.splice(0)]) {
      waiting.resolve(refusal);
    }
  }

  function gapFactor(): number {
    const slowedUntil = state?.slowedUntil ?? null;
    return slowedUntil !== null && slowedUntil.getTime() > clock.now() ? SlowedGapFactor : 1;
  }

  function gapMs(): number {
    return (pacing.minGapMs + random() * (pacing.maxGapMs - pacing.minGapMs)) * gapFactor();
  }

  /** An outcome whose scope is the egress (outcomes.md section 4) rests its page loads. */
  function noteOutcome(response: UpstreamResponse): void {
    const outcome = classifyEnvelope(response);
    if (outcome === null || outcome.kind !== "failure") {
      return;
    }

    const cooldownMs = pageCooldownMs(outcome);
    const slowdownMs = pageSlowdownMs(outcome);
    if (cooldownMs === 0 && slowdownMs === 0) {
      return;
    }

    const now = clock.now();
    state = {
      cooldownUntil: new Date(now + cooldownMs),
      reason: outcome.code,
      slowedUntil: slowdownMs === 0 ? (state?.slowedUntil ?? null) : new Date(now + slowdownMs),
    };
    states.put(egress.id, state);
  }

  return {
    send: (request, priority) =>
      new Promise((resolve, reject) => {
        queues[priority].push({ request, resolve, reject });
        if (!isRunning) {
          void run();
        }
      }),
    secondsPerPage: () => averageGapSeconds(pacing) * gapFactor(),
  };
}
