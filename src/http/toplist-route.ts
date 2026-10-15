/**
 * `GET /api/v1/toplists/{type}?period=` (ADR-0010): the whole toplist, 202 while it is being read,
 * or the problem that stopped the last read.
 */
import type { ProblemCode } from "../domain/outcomes";
import {
  type ToplistPeriod,
  ToplistPeriods,
  type ToplistType,
  ToplistTypes,
} from "../domain/toplist";
import type { ToplistAnswer, ToplistService } from "../toplists/service";
import type { PageStop } from "../toplists/walk";
import { problemResponse } from "./problem";
import type { Route } from "./router";

const ServedTypes: readonly ToplistType[] = ["galleries"];

export function toplistRoute(toplists: ToplistService): Route {
  return {
    method: "GET",
    path: "/api/v1/toplists/:type",
    handler: (_request, { params, url, requestId, timing }) => {
      const type = params.type;
      const period = url.searchParams.get("period");
      if (!isOneOf(ToplistTypes, type)) {
        return problemResponse("invalid_request", requestId, {
          detail: `type must be one of ${ToplistTypes.join(", ")}`,
        });
      }

      if (!isOneOf(ToplistPeriods, period)) {
        return problemResponse("invalid_request", requestId, {
          detail: `period must be one of ${ToplistPeriods.join(", ")}`,
        });
      }

      if (!ServedTypes.includes(type)) {
        return problemResponse("not_implemented", requestId, {
          detail: `the ${type} toplists are not served yet`,
        });
      }

      const answer = timing.measure("store", () => toplists.get(period));
      return answerResponse(type, period, answer, requestId);
    },
  };
}

function answerResponse(
  type: ToplistType,
  period: ToplistPeriod,
  answer: ToplistAnswer,
  requestId: string,
): Response {
  switch (answer.kind) {
    case "snapshot":
      return Response.json({
        type,
        period,
        observedAt: answer.snapshot.observedAt.toISOString(),
        entries: answer.snapshot.entries.map(({ rank, score, gallery }) => ({
          rank,
          score,
          gallery: { gid: gallery.gid, token: gallery.token },
        })),
      });
    case "pending":
      return Response.json(
        {
          type,
          period,
          pagesDone: answer.progress?.pagesDone ?? 0,
          ...(answer.progress === null ? {} : { pagesTotal: answer.progress.pagesTotal }),
        },
        { status: 202, headers: { "Retry-After": String(answer.retryAfterSeconds) } },
      );
    case "stopped":
      return problemResponse(stopCode(answer.stop), requestId, {
        detail: stopDetail(answer.stop),
        retryAfterSeconds: answer.retryAfterSeconds,
      });
  }
}

function stopCode(stop: PageStop): ProblemCode {
  switch (stop.kind) {
    case "failure":
      return stop.code;
    case "network":
      return "network";
    case "unrecognized":
      return "upstream_unrecognized";
    case "refused":
      return "egress_cooldown";
  }
}

/** The site's own words for a failure; never a page's content or an upstream address. */
function stopDetail(stop: PageStop): string {
  switch (stop.kind) {
    case "failure":
      return stop.message;
    case "network":
      return "the site did not answer";
    case "unrecognized":
      return `a toplist page was not recognized at ${stop.marker}`;
    case "refused":
      return `the egress rests until ${stop.until.toISOString()} after ${stop.reason}`;
  }
}

function isOneOf<T extends string>(
  values: readonly T[],
  value: string | null | undefined,
): value is T {
  return values.some((known) => known === value);
}
