/**
 * Starts EhServer. Requests go to the mock, or to the site through a proxy (ADR-0011); no egress
 * sends from this machine's own connection.
 *
 * Usage: bun src/main.ts --data <folder> (--mock <mock url> | --proxy <name>=<proxy url>)
 *        [--listen 127.0.0.1] [--port 8080]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { type Egress, mockEgress, proxyEgress } from "./egress/egress";
import { proxyEgressProblem } from "./egress/proxy-check";
import { withNetworkRetries } from "./governor/network-retries";
import { createPageLane, pagePacingFor, SystemClock } from "./governor/page-lane";
import { createApp } from "./http/app";
import { toplistRoute } from "./http/toplist-route";
import { createLogger, type Logger } from "./log/logger";
import { openDatabase } from "./store/database";
import { egressStateStore } from "./store/egress-states";
import { toplistSnapshotStore } from "./store/toplist-snapshots";
import { createToplistService } from "./toplists/service";

/** nfr.md SEC-3: only this machine can connect unless told otherwise. */
const DefaultListen = "127.0.0.1";
const DefaultPort = 8080;
const DatabaseFile = "ehserver.db";
const UsageExitCode = 64;
/** sysexits EX_CONFIG: the proxy on the command line may not be used. */
const RefusedProxyExitCode = 78;
const ProxyName = /^[a-z0-9][a-z0-9-]*$/;
const Usage =
  "usage: --data <folder> (--mock <mock url> | --proxy <name>=<proxy url>) [--listen <address>] [--port <port>]";

export interface ServerOptions {
  readonly dataDir: string;
  /** Already checked: the proxy's start-up check runs before the server starts. */
  readonly egress: Egress;
  readonly listen?: string | undefined;
  readonly port?: number | undefined;
  readonly log: Logger;
}

export interface RunningServer {
  readonly url: string;
  /** Stops taking requests, lets running walks end, then closes the database. */
  stop(): Promise<void>;
}

export function startServer({
  dataDir,
  egress,
  listen = DefaultListen,
  port = DefaultPort,
  log,
}: ServerOptions): RunningServer {
  mkdirSync(dataDir, { recursive: true });
  const db = openDatabase(join(dataDir, DatabaseFile));
  const lane = createPageLane(egress, pagePacingFor(egress.profile), egressStateStore(db));
  const toplists = createToplistService({
    store: toplistSnapshotStore(db),
    send: withNetworkRetries((request) => lane.send(request, "background"), SystemClock.sleep),
    secondsPerPage: () => lane.secondsPerPage(),
  });
  const app = createApp({
    routes: [toplistRoute(toplists)],
    onError: (error, requestId) => log.error("request failed", { requestId, error }),
  });
  const server = Bun.serve({ hostname: listen, port, fetch: (request) => app.fetch(request) });
  const url = `http://${listen}:${server.port}`;
  log.info("server started", { url, egress: egress.id });
  return {
    url,
    stop: async () => {
      await server.stop();
      await toplists.whenIdle();
      db.close();
    },
  };
}

/** `<name>=<url>`, or null when the argument is not one. */
function parseProxyArgument(argument: string): { name: string; url: URL } | null {
  const separator = argument.indexOf("=");
  const name = argument.slice(0, separator);
  const url = URL.parse(argument.slice(separator + 1));
  return separator > 0 && ProxyName.test(name) && url !== null ? { name, url } : null;
}

/** The egress the command line names, once its start-up check passed; exits otherwise. */
async function commandLineEgress(
  mock: string | undefined,
  proxy: string | undefined,
  log: Logger,
): Promise<Egress> {
  if (mock !== undefined && proxy === undefined) {
    return mockEgress(mock);
  }

  const named = mock === undefined && proxy !== undefined ? parseProxyArgument(proxy) : null;
  if (named === null) {
    log.error(Usage);
    process.exit(UsageExitCode);
  }

  const problem = await proxyEgressProblem(named.url);
  if (problem !== null) {
    log.error("proxy refused", { proxy: named.name, problem });
    process.exit(RefusedProxyExitCode);
  }

  return proxyEgress(named.name, named.url);
}

if (import.meta.main) {
  const log = createLogger((line) => process.stdout.write(line));
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      data: { type: "string" },
      mock: { type: "string" },
      proxy: { type: "string" },
      listen: { type: "string" },
      port: { type: "string" },
    },
  });
  if (values.data === undefined) {
    log.error(Usage);
    process.exit(UsageExitCode);
  }

  startServer({
    dataDir: values.data,
    egress: await commandLineEgress(values.mock, values.proxy, log),
    listen: values.listen,
    port: values.port === undefined ? undefined : Number(values.port),
    log,
  });
}
