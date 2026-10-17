/**
 * Starts EhServer from its one configuration file (ADR-0012). Requests go to the mock, or to the
 * site through a proxy (ADR-0011); no egress sends from this machine's own connection.
 *
 * Usage: bun src/main.ts --config <file> [create-admin-token <user name>]
 */
import type { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { apiTokens } from "./auth/api-tokens";
import { type EgressConfig, readConfig, type ServerConfig } from "./config/config";
import { ApiContract } from "./contract/api-contract";
import { checkSchema, findingText } from "./contract/schema";
import { type Egress, mockEgress, proxyEgress } from "./egress/egress";
import { proxyEgressProblem } from "./egress/proxy-check";
import { withNetworkRetries } from "./governor/network-retries";
import { createPageLane, pagePacingFor, SystemClock } from "./governor/page-lane";
import { createApp } from "./http/app";
import { toplistRoute } from "./http/toplist-route";
import { createLogger, type Logger } from "./log/logger";
import { apiTokenStore } from "./store/api-tokens";
import { openDatabase } from "./store/database";
import { egressStateStore } from "./store/egress-states";
import { toplistSnapshotStore } from "./store/toplist-snapshots";
import { userStore } from "./store/users";
import { createToplistService } from "./toplists/service";

/** nfr.md SEC-3: only this machine can connect unless told otherwise. */
const DefaultListen = "127.0.0.1";
const DefaultPort = 8080;
const DatabaseFile = "ehserver.db";
const UsageExitCode = 64;
/** sysexits EX_CONFIG: the configuration, or the proxy it names, may not be used. */
const RefusedConfigExitCode = 78;
const Usage = "usage: --config <file> [create-admin-token <user name>]";
/** Names the token after the command that made it. */
const AdminTokenName = "create-admin-token";

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

type Command =
  | { readonly kind: "serve"; readonly configPath: string }
  | { readonly kind: "createAdminToken"; readonly configPath: string; readonly userName: string };

export function startServer({
  dataDir,
  egress,
  listen = DefaultListen,
  port = DefaultPort,
  log,
}: ServerOptions): RunningServer {
  const db = openDataDatabase(dataDir);
  const lane = createPageLane(egress, pagePacingFor(egress.profile), egressStateStore(db));
  const toplists = createToplistService({
    store: toplistSnapshotStore(db),
    send: withNetworkRetries((request) => lane.send(request, "background"), SystemClock.sleep),
    secondsPerPage: () => lane.secondsPerPage(),
  });
  const tokens = apiTokens(apiTokenStore(db));
  const app = createApp({
    routes: [toplistRoute(toplists)],
    authenticate: tokens.authenticate,
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

/**
 * A new admin token for the user with this name, who is made first when there is none (ADR-0006).
 * Returns the token's secret, which is kept nowhere.
 */
export function createAdminToken(dataDir: string, userName: string): string {
  const db = openDataDatabase(dataDir);
  try {
    const users = userStore(db);
    const user = users.byName(userName) ?? users.create(userName, new Date());
    if (user === null) {
      throw new Error(`the user ${userName} was made elsewhere meanwhile; run the command again`);
    }

    return apiTokens(apiTokenStore(db)).issue({
      userId: user.id,
      name: AdminTokenName,
      scopes: ["admin"],
      expiresAt: null,
    }).secret;
  } finally {
    db.close();
  }
}

function openDataDatabase(dataDir: string): Database {
  mkdirSync(dataDir, { recursive: true });
  return openDatabase(join(dataDir, DatabaseFile));
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

/** Prints the secret alone, so that a script can take it; exits on a name the API refuses. */
function printAdminToken(dataDir: string, userName: string, log: Logger): void {
  const userNameSchema = ApiContract.resolve("#/components/schemas/UserName");
  const findings = checkSchema(userNameSchema, userName, ApiContract.resolve, "user name");
  if (findings.length > 0) {
    log.error("user name refused", { problems: findings.map(findingText) });
    process.exit(UsageExitCode);
  }

  process.stdout.write(`${createAdminToken(dataDir, userName)}\n`);
}

/** What the command line asks for; null for anything else. */
function commandFrom(args: string[]): Command | null {
  const parsed = parsedArgs(args);
  const configPath = parsed?.values.config;
  if (parsed === null || configPath === undefined) {
    return null;
  }

  const [verb, userName, ...rest] = parsed.positionals;
  if (verb === undefined) {
    return { kind: "serve", configPath };
  }

  return verb === "create-admin-token" && userName !== undefined && rest.length === 0
    ? { kind: "createAdminToken", configPath, userName }
    : null;
}

function parsedArgs(args: string[]) {
  try {
    return parseArgs({ args, options: { config: { type: "string" } }, allowPositionals: true });
  } catch {
    return null;
  }
}

if (import.meta.main) {
  const log = createLogger((line) => process.stdout.write(line));
  const command = commandFrom(Bun.argv.slice(2));
  if (command === null) {
    log.error(Usage);
    process.exit(UsageExitCode);
  }

  const config = configFrom(command.configPath, log);
  if (command.kind === "createAdminToken") {
    printAdminToken(config.dataDir, command.userName, log);
  } else {
    startServer({
      dataDir: config.dataDir,
      egress: await checkedEgress(config.egress, log),
      listen: config.listen,
      port: config.port,
      log,
    });
  }
}
