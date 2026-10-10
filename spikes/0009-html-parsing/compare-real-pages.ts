/**
 * Runs both spike parsers over a folder of captured pages and prints, per page, what each one
 * recognized, whether they agree, and how long they took. Captured pages stay outside the
 * repository (fixtures/README.md); this prints markers and counts, never page content.
 *
 * Usage: bun spikes/0009-html-parsing/compare-real-pages.ts <folder> [--runs 30]
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { parseDetailPage as domDetail } from "./dom/detail-page";
import { parseListPage as domList } from "./dom/list-page";
import type { DetailParse, ListParse } from "./readings";
import { parseDetailPage as rewriterDetail } from "./rewriter/detail-page";
import { parseListPage as rewriterList } from "./rewriter/list-page";

type Parse = ListParse | DetailParse;

const DefaultRuns = 30;

function describe(result: Parse): string {
  switch (result.kind) {
    case "success":
      return "items" in result.value
        ? `success: ${result.value.items.length} items`
        : `success: ${result.value.tags.length} tags, ${result.value.comments.length} comments`;
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

function compare(html: string, runs: number, dom: (html: string) => Parse, rewriter: typeof dom) {
  const domResult = dom(html);
  const rewriterResult = rewriter(html);
  return {
    dom: describe(domResult),
    rewriter: describe(rewriterResult),
    agree: Bun.deepEquals(domResult, rewriterResult),
    domMs: medianMs(runs, () => dom(html)),
    rewriterMs: medianMs(runs, () => rewriter(html)),
  };
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: { runs: { type: "string" } },
    allowPositionals: true,
  });
  const folder = positionals[0];
  if (folder === undefined) {
    console.error("compare-real-pages: usage: <folder> [--runs 30]");
    process.exit(64);
  }

  const runs = Number(values.runs ?? DefaultRuns);
  const names = (await readdir(folder)).filter((name) => name.endsWith(".html")).sort();
  const items = [];
  for (const name of names) {
    const html = await Bun.file(join(folder, name)).text();
    items.push({
      page: name,
      kb: Math.round(html.length / 1024),
      list: compare(html, runs, domList, rewriterList),
      detail: compare(html, runs, domDetail, rewriterDetail),
    });
  }

  const disagreements = items.filter((item) => !item.list.agree || !item.detail.agree).length;
  console.log(
    JSON.stringify(
      {
        ok: disagreements === 0,
        summary: `${items.length} pages, ${disagreements} disagreements`,
        items,
      },
      null,
      1,
    ),
  );
  process.exit(disagreements === 0 ? 0 : 2);
}

if (import.meta.main) {
  await main();
}
