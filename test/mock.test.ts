/** The mock's behaviour that later tests of the server rely on (nfr.md TEST-1, outcomes.md R7). */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { CatalogSize, FirstGid, galleryToken, ListPageSize } from "../mock/catalog";
import { type FaultName, RetryAfterSeconds } from "../mock/faults";
import { startMock } from "../mock/server";

const mock = startMock();
const NewestGid = FirstGid + CatalogSize - 1;

afterAll(() => mock.stop());

beforeEach(() => {
  mock.clearFaults();
  mock.clearRequests();
});

function get(path: string, host = "e-hentai.org", init?: RequestInit): Promise<Response> {
  return fetch(`${mock.url}/${host}${path}`, init);
}

async function getText(path: string, host = "e-hentai.org"): Promise<string> {
  return (await get(path, host)).text();
}

function listedGids(html: string): number[] {
  return [...html.matchAll(/<a href="[^"]*\/g\/(\d+)\/[0-9a-f]{10}\/"><div class="glink">/g)].map(
    (match) => Number(match[1]),
  );
}

function cursor(html: string, id: "unext" | "uprev"): number | null {
  const match = new RegExp(`id="${id}" href="[^"]*(?:next|prev)=(\\d+)"`).exec(html);
  return match === null ? null : Number(match[1]);
}

function newestFirst(from: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => from - index);
}

describe("mock search pages", () => {
  test("the first page lists the newest galleries and offers only a next page", async () => {
    const html = await getText("/");

    expect(listedGids(html)).toEqual(newestFirst(NewestGid, ListPageSize));
    expect(cursor(html, "unext")).toBe(NewestGid - ListPageSize + 1);
    expect(cursor(html, "uprev")).toBeNull();
    expect(html).toContain("Found 60 results.");
  });

  test("next and prev cursors walk the catalogue both ways", async () => {
    const second = await getText(`/?next=${NewestGid - ListPageSize + 1}`);
    const back = await getText(`/?prev=${NewestGid - ListPageSize}`);

    expect(listedGids(second)).toEqual(newestFirst(NewestGid - ListPageSize, ListPageSize));
    expect(cursor(second, "uprev")).toBe(NewestGid - ListPageSize);
    expect(listedGids(back)).toEqual(newestFirst(NewestGid, ListPageSize));
  });

  test("the last page offers no next page", async () => {
    const last = await getText(`/?next=${FirstGid + 10}`);

    expect(listedGids(last)).toEqual(newestFirst(FirstGid + 9, 10));
    expect(cursor(last, "unext")).toBeNull();
  });

  test("a search term narrows the list, and a search that matches nothing gets the no-hits page", async () => {
    const narrowed = await getText("/?f_search=synthetic+tag+3");
    const nothing = await getText("/?f_search=nothing+matches+this");

    expect(listedGids(narrowed).length).toBe(CatalogSize / 5);
    expect(nothing).toContain("No hits found</p>");
  });
});

describe("mock gallery pages", () => {
  test("a gallery page carries the gallery's script variables and its first previews", async () => {
    const html = await getText(`/g/${FirstGid}/${galleryToken(FirstGid)}/`);

    expect(html).toContain(`var gid = ${FirstGid};`);
    expect(html).toContain(`var token = "${galleryToken(FirstGid)}";`);
    expect(html).toContain("Showing 1 - 11 of 11 images");
  });

  test("the p parameter serves a later page of previews", async () => {
    const gid = FirstGid + 28;
    const html = await getText(`/g/${gid}/${galleryToken(gid)}/?p=1`);

    expect(html).toContain("Showing 21 - 39 of 39 images");
    expect(html).toContain(`/${gid}-21"`);
  });

  test("a wrong token gets the key-missing error box", async () => {
    const html = await getText(`/g/${FirstGid}/0000000000/`);

    expect(html).toContain('<div class="d">\n<p>Key missing, or incorrect key provided.</p>');
  });

  test("an unknown host is refused, so a wrong mock address shows at once", async () => {
    expect((await get("/", "example.org")).status).toBe(404);
  });
});

describe("TEST-1: mock faults", () => {
  type FaultCase = [fault: FaultName, status: number, signature: string];

  test.each<FaultCase>([
    ["http_429", 429, ""],
    ["cloudflare_403", 403, "<title>Just a moment...</title>"],
    ["backend_fetch_failed", 503, "Backend fetch failed"],
    ["ban_text", 200, "Your IP address has been temporarily banned for excessive pageloads"],
    ["too_fast_text", 200, "You are opening"],
    ["kokomade", 200, "https://exhentai.org/img/kokomade.jpg"],
    ["content_warning", 200, "you lose all rights to complain about it in the future.)</p>"],
    ["gallery_removed", 200, "<p>This gallery is pining for the fjords.</p>"],
    ["gallery_unavailable", 200, "<p>This gallery is unavailable"],
    ["key_missing", 200, "<p>Key missing, or incorrect key provided.</p>"],
    ["error_box", 200, '<div class="d">\n<p>Synthetic site error.</p>'],
  ])("%p answers HTTP %p with its signature", async (fault, status, signature) => {
    mock.addFault({ fault, times: 1 });

    const response = await get("/");

    expect(response.status).toBe(status);
    expect(await response.text()).toContain(signature);
  });

  test("http_429 says when to retry and cloudflare_403 marks the challenge", async () => {
    mock.addFault({ fault: "http_429", times: 1 });
    mock.addFault({ fault: "cloudflare_403", times: 1 });

    const limited = await get("/");
    const challenged = await get("/");

    expect(limited.headers.get("retry-after")).toBe(String(RetryAfterSeconds));
    expect(challenged.headers.get("cf-mitigated")).toBe("challenge");
  });

  test("the ban notice is plain text and empty_body has no body", async () => {
    mock.addFault({ fault: "ban_text", times: 1 });
    mock.addFault({ fault: "empty_body", times: 1 });

    const ban = await getText("/");
    const empty = await getText("/");

    expect(ban).not.toContain("<");
    expect(ban).toMatch(/The ban expires in .+$/);
    expect(empty).toBe("");
  });

  test("sad_panda sends the headers and length clients recognize", async () => {
    mock.addFault({ fault: "sad_panda", times: 1 });

    const response = await get("/", "exhentai.org");

    expect(response.headers.get("content-type")).toBe("image/gif");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="sadpanda.jpg"');
    expect((await response.arrayBuffer()).byteLength).toBe(9615);
  });

  test("connection_reset breaks the transfer", async () => {
    mock.addFault({ fault: "connection_reset", times: 1 });

    await expect(get("/").then((response) => response.text())).rejects.toThrow();
  });

  test("no_answer holds the request until the client gives up", async () => {
    mock.addFault({ fault: "no_answer", times: 1 });

    const attempt = get("/", "e-hentai.org", { signal: AbortSignal.timeout(50) });

    await expect(attempt).rejects.toThrow();
  });

  test("a rule ends after its count, then the normal answer returns", async () => {
    mock.addFault({ fault: "ban_text", times: 2 });

    const answers = [await getText("/"), await getText("/"), await getText("/")];

    expect(answers.map((html) => html.startsWith("Your IP address"))).toEqual([true, true, false]);
  });

  test("a rule can target one host and one path prefix", async () => {
    mock.addFault({ fault: "key_missing", host: "exhentai.org", pathPrefix: "/g/", times: 5 });

    const otherHost = await getText(`/g/${FirstGid}/${galleryToken(FirstGid)}/`);
    const otherPath = await getText("/", "exhentai.org");
    const matching = await getText(`/g/${FirstGid}/${galleryToken(FirstGid)}/`, "exhentai.org");

    expect(otherHost).toContain(`var gid = ${FirstGid};`);
    expect(otherPath).toContain('class="itg gltc"');
    expect(matching).toContain("Key missing");
  });

  test("PERF-4: the request log records every upstream request in order", async () => {
    await get("/?f_search=synthetic");
    await get(`/g/${FirstGid}/${galleryToken(FirstGid)}/`, "exhentai.org");

    expect(mock.requests()).toEqual([
      { method: "GET", host: "e-hentai.org", path: "/", query: "?f_search=synthetic" },
      {
        method: "GET",
        host: "exhentai.org",
        path: `/g/${FirstGid}/${galleryToken(FirstGid)}/`,
        query: "",
      },
    ]);
  });

  test("the control API adds a rule over HTTP and refuses a malformed one", async () => {
    const post = (body: unknown) =>
      fetch(`${mock.url}/__mock/faults`, { method: "POST", body: JSON.stringify(body) });

    const added = await post({ fault: "ban_text", times: 1 });
    const unknownFault = await post({ fault: "meteor", times: 1 });
    const noCount = await post({ fault: "ban_text" });

    expect([added.status, unknownFault.status, noCount.status]).toEqual([201, 400, 400]);
    expect(await getText("/")).toStartWith("Your IP address");
  });
});
