/** The vertical slice end to end: HTTP, toplist service, governor, egress, mock (N8; ADR-0010). */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CatalogSize } from "../mock/catalog";
import { startMock } from "../mock/server";
import { createLogger } from "../src/log/logger";
import { startServer } from "../src/main";
import { responseFindings } from "./support/contract";

const mock = startMock();
const dataDir = mkdtempSync(join(tmpdir(), "ehserver-data-"));
const logLines: string[] = [];
const server = startServer({
  dataDir,
  mockUrl: mock.url,
  port: 0,
  log: createLogger((line) => logLines.push(line)),
});

afterAll(async () => {
  await server.stop();
  await mock.stop();
  rmSync(dataDir, { recursive: true, force: true });
});

const PollMs = 20;
const PollLimit = 250;

async function getToplist(query: string): Promise<Response> {
  return fetch(`${server.url}/api/v1/toplists/${query}`);
}

/** Polls as a client would, until the whole toplist is there. */
async function whenServed(query: string): Promise<Response> {
  for (let attempt = 0; attempt < PollLimit; attempt++) {
    const response = await getToplist(query);
    if (response.status !== 202) {
      return response;
    }

    await Bun.sleep(PollMs);
  }

  throw new Error(`no toplist after ${PollLimit} polls`);
}

describe("EhServer", () => {
  test("SEC-3: listens on this machine only, and says where", () => {
    expect(server.url).toStartWith("http://127.0.0.1:");
    expect(logLines.map((line) => JSON.parse(line).event)).toContain("server started");
  });

  test("ADR-0010: answers 202 while the toplist is read through the mock, then serves it whole", async () => {
    const first = await getToplist("galleries?period=pastMonth");
    expect(first.status).toBe(202);
    expect(Number(first.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(await responseFindings("getToplist", first)).toEqual([]);

    const served = await whenServed("galleries?period=pastMonth");
    expect(await responseFindings("getToplist", served)).toEqual([]);
    const body = (await served.json()) as { readonly entries: readonly unknown[] };

    expect(served.status).toBe(200);
    expect(body.entries).toHaveLength(CatalogSize);
    expect(served.headers.get("X-Request-Id")).toStartWith("req_");
    expect(served.headers.get("Server-Timing")).toContain("store;dur=");
  });

  test("a toplist type not served yet is a 501 problem", async () => {
    const response = await getToplist("tagging?period=yesterday");

    expect(response.status).toBe(501);
    expect(await responseFindings("getToplist", response)).toEqual([]);
  });
});
