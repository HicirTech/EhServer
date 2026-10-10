import { detailPageHtml, errorBoxPageHtml } from "../fixtures/eh/detail-page";
import { listPageHtml, noHitsPageHtml } from "../fixtures/eh/list-page";
import type { Site } from "../fixtures/eh/page-shell";
import {
  catalogGids,
  galleryPage,
  galleryToken,
  isCatalogGid,
  ListPageSize,
  listRow,
  matchesSearch,
} from "./catalog";
import { type FaultName, faultResponse, html, isFaultName, KeyMissingText } from "./faults";

/** Upstream URL `https://<host>/<path>` is served at `<mock url>/<host>/<path>`. */
const Hosts: Readonly<Record<string, Site>> = {
  "e-hentai.org": "eh",
  "exhentai.org": "ex",
};

export interface FaultRule {
  readonly fault: FaultName;
  /** Matches every host when absent. */
  readonly host?: string | undefined;
  /** Matches every path when absent; compared with the upstream path, for example `/g/`. */
  readonly pathPrefix?: string | undefined;
  /** How many matching requests get the fault before the mock answers normally again. */
  readonly times: number;
}

export interface MockRequest {
  readonly method: string;
  readonly host: string;
  readonly path: string;
  readonly query: string;
}

export interface Mock {
  readonly url: string;
  addFault(rule: FaultRule): void;
  clearFaults(): void;
  requests(): readonly MockRequest[];
  clearRequests(): void;
  stop(): Promise<void>;
}

interface State {
  readonly rules: { rule: FaultRule; remaining: number }[];
  readonly log: MockRequest[];
}

export function startMock(port = 0): Mock {
  const state: State = { rules: [], log: [] };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    fetch: (request) => handle(request, state),
  });
  return {
    url: `http://127.0.0.1:${server.port}`,
    addFault: (rule) => addFault(state, rule),
    clearFaults: () => state.rules.splice(0),
    requests: () => [...state.log],
    clearRequests: () => state.log.splice(0),
    stop: () => server.stop(true),
  };
}

function handle(request: Request, state: State): Response | Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/__mock/")) {
    return control(request, url, state);
  }

  const [, host = "", ...rest] = url.pathname.split("/");
  const site = Hosts[host];
  if (site === undefined) {
    return new Response(`mock: unknown host ${host}`, { status: 404 });
  }

  const path = `/${rest.join("/")}`;
  state.log.push({ method: request.method, host, path, query: url.search });
  const fault = takeFault(state, host, path);
  return fault === undefined ? route(site, path, url.searchParams) : faultResponse(fault, request);
}

function takeFault(state: State, host: string, path: string): FaultName | undefined {
  const entry = state.rules.find(
    ({ rule, remaining }) =>
      remaining > 0 &&
      (rule.host === undefined || rule.host === host) &&
      (rule.pathPrefix === undefined || path.startsWith(rule.pathPrefix)),
  );
  if (entry === undefined) {
    return undefined;
  }

  entry.remaining--;
  return entry.rule.fault;
}

function addFault(state: State, rule: FaultRule): void {
  state.rules.push({ rule, remaining: rule.times });
}

function route(site: Site, path: string, query: URLSearchParams): Response {
  if (path === "/") {
    return listResponse(site, query);
  }

  const gallery = /^\/g\/(\d+)\/([0-9a-f]{10})\/$/.exec(path);
  if (gallery !== null) {
    return detailResponse(site, Number(gallery[1]), gallery[2] ?? "", Number(query.get("p") ?? 0));
  }

  return new Response("Not Found", { status: 404 });
}

/** `next=<gid>` lists older galleries, `prev=<gid>` newer ones, newest first as the site does. */
function listResponse(site: Site, query: URLSearchParams): Response {
  const search = query.get("f_search") ?? "";
  const matching = catalogGids().filter((gid) => matchesSearch(gid, search));
  if (matching.length === 0) {
    return html(noHitsPageHtml(site));
  }

  const page = pageOf(matching, Number(query.get("next")), Number(query.get("prev")));
  const first = page[0];
  const last = page.at(-1);
  return html(
    listPageHtml({
      site,
      rows: page.map(listRow),
      searchText: `Found ${matching.length.toLocaleString("en-US")} results.`,
      prevGid: first !== undefined && first < (matching[0] ?? 0) ? first : null,
      nextGid: last !== undefined && last > (matching.at(-1) ?? 0) ? last : null,
    }),
  );
}

function pageOf(newestFirst: readonly number[], next: number, prev: number): number[] {
  if (next > 0) {
    return newestFirst.filter((gid) => gid < next).slice(0, ListPageSize);
  }

  if (prev > 0) {
    return newestFirst.filter((gid) => gid > prev).slice(-ListPageSize);
  }

  return newestFirst.slice(0, ListPageSize);
}

function detailResponse(site: Site, gid: number, token: string, previewPage: number): Response {
  if (!isCatalogGid(gid) || galleryToken(gid) !== token) {
    return html(errorBoxPageHtml(KeyMissingText, site));
  }

  const page = galleryPage(site, gid, previewPage);
  return page === null ? new Response("Not Found", { status: 404 }) : html(detailPageHtml(page));
}

async function control(request: Request, url: URL, state: State): Promise<Response> {
  const key = `${request.method} ${url.pathname}`;
  if (key === "POST /__mock/faults") {
    const rule = readFaultRule(await request.json().catch(() => null));
    if (rule === null) {
      return Response.json(
        { error: "expected { fault, host?, pathPrefix?, times }" },
        { status: 400 },
      );
    }

    addFault(state, rule);
    return Response.json(rule, { status: 201 });
  }

  if (key === "DELETE /__mock/faults") {
    state.rules.splice(0);
    return new Response(null, { status: 204 });
  }

  if (key === "GET /__mock/requests") {
    return Response.json(state.log);
  }

  if (key === "DELETE /__mock/requests") {
    state.log.splice(0);
    return new Response(null, { status: 204 });
  }

  return Response.json({ error: `unknown control ${key}` }, { status: 404 });
}

function readFaultRule(body: unknown): FaultRule | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { fault, host, pathPrefix, times } = body as Record<string, unknown>;
  const isOptionalString = (value: unknown): value is string | undefined =>
    value === undefined || typeof value === "string";
  if (!isFaultName(fault) || !isOptionalString(host) || !isOptionalString(pathPrefix)) {
    return null;
  }

  if (typeof times !== "number" || !Number.isInteger(times) || times < 1) {
    return null;
  }

  return { fault, host, pathPrefix, times };
}
