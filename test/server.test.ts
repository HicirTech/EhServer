/**
 * The vertical slice end to end: tokens, HTTP, toplist service, governor, egress, mock (N8;
 * ADR-0006, ADR-0010).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CatalogSize } from "../mock/catalog";
import { startMock } from "../mock/server";
import { mockEgress } from "../src/egress/egress";
import { createLogger } from "../src/log/logger";
import { createAdminToken, startServer } from "../src/main";
import { responseFindings } from "./support/contract";

const mock = startMock();
const dataDir = mkdtempSync(join(tmpdir(), "ehserver-data-"));
const logLines: string[] = [];
const server = startServer({
  dataDir,
  egress: mockEgress(mock.url),
  port: 0,
  log: createLogger((line) => logLines.push(line)),
});
const adminSecret = createAdminToken(dataDir, "admin");

afterAll(async () => {
  await server.stop();
  await mock.stop();
  rmSync(dataDir, { recursive: true, force: true });
});

const PollMs = 20;
const PollLimit = 250;

function getToplist(query: string, url = server.url, secret = adminSecret): Promise<Response> {
  return fetch(`${url}/api/v1/toplists/${query}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
}

function admin(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${server.url}/api/v1/admin/${path}`, {
    method,
    headers: { Authorization: `Bearer ${adminSecret}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Polls as a client would, until the answer is no longer 202. */
async function whenServed(
  query: string,
  url = server.url,
  secret = adminSecret,
): Promise<Response> {
  for (let attempt = 0; attempt < PollLimit; attempt++) {
    const response = await getToplist(query, url, secret);
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

  test("SEC-2: without a token nothing is served", async () => {
    const response = await fetch(`${server.url}/api/v1/toplists/galleries?period=yesterday`);

    expect(response.status).toBe(401);
    expect(await responseFindings("getToplist", response)).toEqual([]);
  });

  test("ADR-0006: an admin makes a user and a read token, which works until it is revoked", async () => {
    const user = (await (await admin("POST", "users", { name: "reader" })).json()) as {
      readonly id: string;
    };
    const created = await admin("POST", "tokens", {
      userId: user.id,
      name: "phone",
      scopes: ["read"],
    });
    const { id, secret } = (await created.json()) as {
      readonly id: string;
      readonly secret: string;
    };

    const read = await whenServed("galleries?period=pastYear", server.url, secret);
    const revoked = await admin("DELETE", `tokens/${id}`);
    const refused = await getToplist("galleries?period=pastYear", server.url, secret);

    expect(created.status).toBe(201);
    expect(read.status).toBe(200);
    expect(revoked.status).toBe(204);
    expect(refused.status).toBe(401);
  });

  test("a toplist type not served yet is a 501 problem", async () => {
    const response = await getToplist("tagging?period=yesterday");

    expect(response.status).toBe(501);
    expect(await responseFindings("getToplist", response)).toEqual([]);
  });

  test("REL-3: a cooldown outlives a restart, so the new server sends nothing while it lasts", async () => {
    const limitedMock = startMock();
    const limitedDir = mkdtempSync(join(tmpdir(), "ehserver-data-"));
    const options = {
      dataDir: limitedDir,
      egress: mockEgress(limitedMock.url),
      port: 0,
      log: createLogger(() => {}),
    };
    try {
      const secret = createAdminToken(limitedDir, "admin");
      limitedMock.addFault({ fault: "http_429", pathPrefix: "/toplist.php", times: 1 });
      const first = startServer(options);
      const limited = await (
        await whenServed("galleries?period=yesterday", first.url, secret)
      ).json();
      await first.stop();
      limitedMock.clearRequests();

      const restarted = startServer(options);
      const refused = await whenServed("galleries?period=pastMonth", restarted.url, secret);
      const refusedBody = await refused.json();
      await restarted.stop();

      expect(limited).toMatchObject({ code: "upstream_rate_limited" });
      expect(refused.status).toBe(503);
      expect(refusedBody).toMatchObject({ code: "egress_cooldown" });
      expect(limitedMock.requests()).toEqual([]);
    } finally {
      await limitedMock.stop();
      rmSync(limitedDir, { recursive: true, force: true });
    }
  });
});
