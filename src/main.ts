/**
 * Starts EhServer. Only the mock egress exists so far (N8), so no request reaches an E-Hentai host.
 *
 * Usage: bun src/main.ts --data <folder> --mock <mock url> [--listen 127.0.0.1] [--port 8080]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { mockEgress } from "./egress/egress";
import { withNetworkRetries } from "./governor/network-retries";
import {
  averageGapSeconds,
  createPageLane,
  MockPagePacing,
  SystemClock,
} from "./governor/page-lane";
import { createApp } from "./http/app";
import { toplistRoute } from "./http/toplist-route";
import { createLogger, type Logger } from "./log/logger";
import { openDatabase } from "./store/database";
import { toplistSnapshotStore } from "./store/toplist-snapshots";
import { createToplistService } from "./toplists/service";

/** nfr.md SEC-3: only this machine can connect unless told otherwise. */
const DefaultListen = "127.0.0.1";
const DefaultPort = 8080;
const DatabaseFile = "ehserver.db";
const UsageExitCode = 64;

export interface ServerOptions {
  readonly dataDir: string;
  readonly mockUrl: string;
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
  mockUrl,
  listen = DefaultListen,
  port = DefaultPort,
  log,
}: ServerOptions): RunningServer {
  mkdirSync(dataDir, { recursive: true });
  const db = openDatabase(join(dataDir, DatabaseFile));
  const lane = createPageLane(mockEgress(mockUrl), MockPagePacing);
  const toplists = createToplistService({
    store: toplistSnapshotStore(db),
    send: withNetworkRetries((request) => lane.send(request, "background"), SystemClock.sleep),
    secondsPerPage: averageGapSeconds(MockPagePacing),
  });
  const app = createApp({
    routes: [toplistRoute(toplists)],
    onError: (error, requestId) => log.error("request failed", { requestId, error }),
  });
  const server = Bun.serve({ hostname: listen, port, fetch: (request) => app.fetch(request) });
  const url = `http://${listen}:${server.port}`;
  log.info("server started", { url, egress: "mock" });
  return {
    url,
    stop: async () => {
      await server.stop();
      await toplists.whenIdle();
      db.close();
    },
  };
}

if (import.meta.main) {
  const log = createLogger((line) => process.stdout.write(line));
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      data: { type: "string" },
      mock: { type: "string" },
      listen: { type: "string" },
      port: { type: "string" },
    },
  });
  if (values.data === undefined || values.mock === undefined) {
    log.error("usage: --data <folder> --mock <mock url> [--listen <address>] [--port <port>]");
    process.exit(UsageExitCode);
  }

  startServer({
    dataDir: values.data,
    mockUrl: values.mock,
    listen: values.listen,
    port: values.port === undefined ? undefined : Number(values.port),
    log,
  });
}
