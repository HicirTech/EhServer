/**
 * Runs the eh-core page parsers over a folder of captured pages and prints, per page, what each
 * parser recognized and how long it took. Captured pages stay outside the repository
 * (fixtures/README.md); this prints result kinds, counts and markers, never page content.
 *
 * Usage: bun scripts/check-captures.ts <folder> [--runs 10]
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { readScriptVariables, readSinglePageVariables } from "../src/eh-core/decoders";
import { classifyEnvelope } from "../src/eh-core/envelope";
import { parseFavoritesPage } from "../src/eh-core/favorites-page";
import { parseGalleryPage } from "../src/eh-core/gallery-page";
import { parseHomePage } from "../src/eh-core/home-page";
import type { ParseResult } from "../src/eh-core/parse-result";
import { parseSearchPage } from "../src/eh-core/search-page";
import { parseSinglePage } from "../src/eh-core/single-page";
import { parseWatchedTagsPage } from "../src/eh-core/watched-tags-page";

const DefaultRuns = 10;
/** "Show All Favorites", then folders 0 to 9. */
const FavoriteSlots = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function describe<T>(result: ParseResult<T, string>, count: (value: T) => string): string {
  switch (result.kind) {
    case "success":
      return `success: ${count(result.value)}`;
    case "empty":
      return `empty: ${result.reason}`;
    case "failure":
      return `failure: ${result.code}`;
    case "unrecognized":
      return `unrecognized: ${result.marker} (${result.raw.length} chars)`;
  }
}

function medianMs(runs: number, parse: () => unknown): number {
  const times: number[] = [];
  for (let run = 0; run < runs; run++) {
    const start = Bun.nanoseconds();
    parse();
    times.push((Bun.nanoseconds() - start) / 1e6);
  }

  times.sort((a, b) => a - b);
  return Math.round((times[Math.floor(runs / 2)] ?? 0) * 100) / 100;
}

function checkPage(html: string, runs: number) {
  const envelope = classifyEnvelope({
    site: "eh",
    status: 200,
    headers: new Headers(),
    body: html,
  });
  if (envelope !== null) {
    return { envelope: describe(envelope, () => "") };
  }

  // A captured page has no request behind it, so the gallery or page it names is taken as expected.
  const expected = readScriptVariables(html) ?? { gid: 0, token: "" };
  const page = readSinglePageVariables(html) ?? { gid: 0, number: 0, pageToken: "" };
  return {
    search: describe(parseSearchPage(html), (value) => `${value.galleries.length} galleries`),
    searchMs: medianMs(runs, () => parseSearchPage(html)),
    gallery: describe(
      parseGalleryPage(html, expected),
      (value) =>
        `${value.gallery.tags.length} tags, ${value.previews.pages.length} previews, ${value.comments.length} comments`,
    ),
    galleryMs: medianMs(runs, () => parseGalleryPage(html, expected)),
    singlePage: describe(
      parseSinglePage(html, page),
      (value) => `image ${value.image.file.width}px`,
    ),
    home: describe(parseHomePage(html), (value) => `${value.mode} limit`),
    favorites: describe(
      parseFavoritesCapture(html),
      (value) => `${value.folders.length} folders, ${value.entries.length} entries`,
    ),
    watchedTags: describe(parseWatchedTagsPage(html), (value) => `${value.tags.length} tags`),
  };
}

/** A captured favourites page shows one folder or all of them: the first view it reads as. */
function parseFavoritesCapture(html: string) {
  const results = FavoriteSlots.map((slot) => parseFavoritesPage(html, slot));
  return results.find((result) => result.kind !== "unrecognized") ?? parseFavoritesPage(html, null);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: { runs: { type: "string" } },
    allowPositionals: true,
  });
  const folder = positionals[0];
  if (folder === undefined) {
    console.error("check-captures: usage: <folder> [--runs 10]");
    process.exit(64);
  }

  const runs = Number(values.runs ?? DefaultRuns);
  const names = (await readdir(folder)).filter((name) => name.endsWith(".html")).sort();
  const items = [];
  for (const name of names) {
    const html = await Bun.file(join(folder, name)).text();
    items.push({ page: name, kb: Math.round(html.length / 1024), ...checkPage(html, runs) });
  }

  console.log(
    JSON.stringify({ ok: true, summary: `${items.length} pages checked`, items }, null, 1),
  );
}

if (import.meta.main) {
  await main();
}
