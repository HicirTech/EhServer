/**
 * Serves galleries toplists whole (ADR-0010): the stored snapshot when there is one, fresh or stale,
 * and a walk when there is none or it is stale. Walks start only on request, one per toplist at a
 * time, and wait before starting again after a walk was discarded or stopped.
 */

import type { ToplistPeriod } from "../domain/toplist";
import type { UpstreamRequest } from "../eh-core/upstream-request";
import { pageCooldownMs } from "../governor/page-cooldowns";
import type { PageAnswer } from "../governor/page-lane";
import type { ToplistSnapshot, ToplistSnapshotStore } from "../store/toplist-snapshots";
import {
  type PageStop,
  type ToplistWalkResult,
  type WalkProgress,
  walkGalleryToplist,
} from "./walk";

export type ToplistAnswer =
  | { readonly kind: "snapshot"; readonly snapshot: ToplistSnapshot }
  /** No snapshot yet: a walk is running, or waits until a discarded walk may be tried again. */
  | {
      readonly kind: "pending";
      readonly progress: WalkProgress | null;
      readonly retryAfterSeconds: number;
    }
  /** No snapshot, and a page stopped the last walk; the next may start after `retryAfterSeconds`. */
  | { readonly kind: "stopped"; readonly stop: PageStop; readonly retryAfterSeconds: number };

export interface ToplistService {
  get(period: ToplistPeriod): ToplistAnswer;
  /** Resolves once no walk is running. */
  whenIdle(): Promise<void>;
}

export interface ToplistServiceOptions {
  readonly store: ToplistSnapshotStore;
  /** Background page loads, network retries included. */
  readonly send: (request: UpstreamRequest) => Promise<PageAnswer>;
  /** The average time between page loads, to tell a waiting client when to come back. */
  readonly secondsPerPage: number;
  readonly now?: () => number;
}

const MinuteMs = 60_000;
const HourMs = 60 * MinuteMs;
const FreshMs = 24 * HourMs;
const MovedRetryMs = 10 * MinuteMs;
const MovedRetryAfterRunMs = HourMs;
const MovedRunLength = 3;
const StoppedRetryMs = 10 * MinuteMs;
/** A galleries toplist has 200 pages, read with its first and last again, until page 0 tells. */
const AssumedWalkPages = 202;

interface Walk {
  progress: WalkProgress | null;
  done: Promise<void>;
}

interface ToplistState {
  walk: Walk | null;
  /** The next walk may start then. */
  notBefore: number;
  movedInARow: number;
  lastStop: PageStop | null;
}

export function createToplistService({
  store,
  send,
  secondsPerPage,
  now = Date.now,
}: ToplistServiceOptions): ToplistService {
  const states = new Map<ToplistPeriod, ToplistState>();

  function stateOf(period: ToplistPeriod): ToplistState {
    const known = states.get(period);
    if (known !== undefined) {
      return known;
    }

    const state: ToplistState = { walk: null, notBefore: 0, movedInARow: 0, lastStop: null };
    states.set(period, state);
    return state;
  }

  function startWalk(period: ToplistPeriod, state: ToplistState): Walk {
    const walk: Walk = { progress: null, done: Promise.resolve() };
    walk.done = walkGalleryToplist(period, send, {
      now: () => new Date(now()),
      onProgress: (progress) => {
        walk.progress = progress;
      },
    })
      .then((result) => finish(period, state, result))
      .finally(() => {
        state.walk = null;
      });
    state.walk = walk;
    return walk;
  }

  function finish(period: ToplistPeriod, state: ToplistState, result: ToplistWalkResult): void {
    if (result.kind === "complete") {
      store.put({ period, observedAt: result.observedAt, entries: result.entries });
      state.notBefore = 0;
      state.movedInARow = 0;
      state.lastStop = null;
      return;
    }

    if (result.kind === "moved") {
      state.movedInARow++;
      state.lastStop = null;
      const wait = state.movedInARow >= MovedRunLength ? MovedRetryAfterRunMs : MovedRetryMs;
      state.notBefore = now() + wait;
      return;
    }

    state.movedInARow = 0;
    state.lastStop = result.stop;
    state.notBefore = now() + Math.max(StoppedRetryMs, restMs(result.stop));
  }

  /** How long the egress rests after the stop: the outcome's cooldown, or what is left of one. */
  function restMs(stop: PageStop): number {
    switch (stop.kind) {
      case "failure":
        return pageCooldownMs(stop);
      case "refused":
        return stop.until.getTime() - now();
      case "network":
      case "unrecognized":
        return 0;
    }
  }

  function secondsUntil(instant: number): number {
    return Math.max(1, Math.ceil((instant - now()) / 1000));
  }

  function walkSecondsLeft(progress: WalkProgress | null): number {
    const pages = progress === null ? AssumedWalkPages : progress.pagesTotal - progress.pagesDone;
    return Math.max(1, Math.ceil(pages * secondsPerPage));
  }

  return {
    get: (period) => {
      const snapshot = store.get(period);
      const state = stateOf(period);
      const isFresh = snapshot !== null && now() - snapshot.observedAt.getTime() < FreshMs;
      const mayWalk = !isFresh && state.walk === null && now() >= state.notBefore;
      const walk = mayWalk ? startWalk(period, state) : state.walk;
      if (snapshot !== null) {
        return { kind: "snapshot", snapshot };
      }

      if (walk !== null) {
        return {
          kind: "pending",
          progress: walk.progress,
          retryAfterSeconds: walkSecondsLeft(walk.progress),
        };
      }

      const retryAfterSeconds = secondsUntil(state.notBefore);
      return state.lastStop === null
        ? { kind: "pending", progress: null, retryAfterSeconds }
        : { kind: "stopped", stop: state.lastStop, retryAfterSeconds };
    },
    whenIdle: async () => {
      await Promise.all([...states.values()].map((state) => state.walk?.done));
    },
  };
}
