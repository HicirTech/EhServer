/**
 * Reads a galleries toplist whole (ADR-0010): every page in order, then the first and the last page
 * again. A page that cannot be read ends the walk with the reason; the caller decides when to retry.
 */
import type { ToplistPeriod } from "../domain/toplist";
import { classifyEnvelope, type UpstreamResponse } from "../eh-core/envelope";
import type { Failure, Unrecognized } from "../eh-core/parse-result";
import {
  type GalleryToplistReading,
  galleryToplistRequest,
  parseGalleryToplistPage,
  type ToplistEntryReading,
} from "../eh-core/toplist-page";
import { assembleToplistWalk } from "../eh-core/toplist-walk";
import type { UpstreamRequest } from "../eh-core/upstream-request";

/** Why a page could not be read: an outcome the site gave, an unknown page, or no answer at all. */
export type PageStop =
  | Failure
  | Unrecognized
  | { readonly kind: "network"; readonly message: string };

export type ToplistWalkResult =
  | {
      readonly kind: "complete";
      readonly entries: readonly ToplistEntryReading[];
      /** When the last page was read again, the latest moment the whole list is known to hold. */
      readonly observedAt: Date;
    }
  | { readonly kind: "moved"; readonly reason: string }
  | { readonly kind: "stopped"; readonly stop: PageStop };

export interface WalkProgress {
  readonly pagesDone: number;
  /** Every page, plus the first and the last again; a single page is read twice. */
  readonly pagesTotal: number;
}

export interface WalkOptions {
  readonly now?: () => Date;
  readonly onProgress?: (progress: WalkProgress) => void;
}

type Send = (request: UpstreamRequest) => Promise<UpstreamResponse>;

export async function walkGalleryToplist(
  period: ToplistPeriod,
  send: Send,
  { now = () => new Date(), onProgress }: WalkOptions = {},
): Promise<ToplistWalkResult> {
  let pagesDone = 0;
  let pagesTotal = 0;
  const read = async (page: number) => {
    const reading = await readPage(period, page, send);
    if (!isStop(reading)) {
      pagesDone++;
      pagesTotal ||= reading.pageCount === 1 ? 2 : reading.pageCount + 2;
      onProgress?.({ pagesDone, pagesTotal });
    }

    return reading;
  };

  const first = await read(0);
  if (isStop(first)) {
    return { kind: "stopped", stop: first };
  }

  const pages = [first];
  for (let page = 1; page < first.pageCount; page++) {
    const reading = await read(page);
    if (isStop(reading)) {
      return { kind: "stopped", stop: reading };
    }

    pages.push(reading);
  }

  const last = pages.length - 1;
  const firstAgain = await read(0);
  if (isStop(firstAgain)) {
    return { kind: "stopped", stop: firstAgain };
  }

  const lastAgain = last === 0 ? firstAgain : await read(last);
  if (isStop(lastAgain)) {
    return { kind: "stopped", stop: lastAgain };
  }

  const walk = assembleToplistWalk(pages, { first: firstAgain, last: lastAgain });
  return walk.kind === "complete"
    ? { kind: "complete", entries: walk.entries, observedAt: now() }
    : walk;
}

async function readPage(
  period: ToplistPeriod,
  page: number,
  send: Send,
): Promise<GalleryToplistReading | PageStop> {
  let response: UpstreamResponse;
  try {
    response = await send(galleryToplistRequest(period, page));
  } catch (error) {
    return { kind: "network", message: error instanceof Error ? error.message : String(error) };
  }

  const envelope = classifyEnvelope(response);
  if (envelope !== null) {
    return envelope;
  }

  const result = parseGalleryToplistPage(response.body, period);
  return result.kind === "success" ? result.value : result;
}

function isStop(reading: GalleryToplistReading | PageStop): reading is PageStop {
  return "kind" in reading;
}
