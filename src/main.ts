/**
 * Starts EhServer from its one configuration file (ADR-0012). Requests go to the mock, or to the
 * site through a proxy (ADR-0011); no egress sends from this machine's own connection.
 *
 * Usage: bun src/main.ts --config <file>
 */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { type EgressConfig, readConfig, type ServerConfig } from "./config/config";
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
/** sysexits EX_CONFIG: the configuration, or the proxy it names, may not be used. */
const RefusedConfigExitCode = 78;
const Usage = "usage: --config <file>";

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

/** The configuration in the file at `path`; exits when it cannot be used. */
function configFrom(path: string, log: Logger): ServerConfig {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    log.error("configuration refused", { problems: [`cannot read ${path}`] });
    process.exit(RefusedConfigExitCode);
  }

  const reading = readConfig(text, dirname(resolve(path)), process.env);
  if (reading.kind === "refused") {
    log.error("configuration refused", { problems: reading.problems });
    process.exit(RefusedConfigExitCode);
  }

  return reading.config;
}

/** The egress the configuration names, once its start-up check passed; exits otherwise. */
async function checkedEgress(egress: EgressConfig, log: Logger): Promise<Egress> {
  if (egress.profile === "mock") {
    return mockEgress(egress.url);
  }

  const problem = await proxyEgressProblem(egress.url);
  if (problem !== null) {
    log.error("proxy refused", { proxy: egress.name, problem });
    process.exit(RefusedConfigExitCode);
  }

  return proxyEgress(egress.name, egress.url);
}

/** The path given with `--config`, or null for any other command line. */
function configPath(args: string[]): string | null {
  try {
    return parseArgs({ args, options: { config: { type: "string" } } }).values.config ?? null;
  } catch {
    return null;
  }
}

if (import.meta.main) {
  const log = createLogger((line) => process.stdout.write(line));
  const path = configPath(Bun.argv.slice(2));
  if (path === null) {
    log.error(Usage);
    process.exit(UsageExitCode);
  }

  const config = configFrom(path, log);
  startServer({
    dataDir: config.dataDir,
    egress: await checkedEgress(config.egress, log),
    listen: config.listen,
    port: config.port,
    log,
  });
}
