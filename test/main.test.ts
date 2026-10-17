/**
 * Starting EhServer from its configuration file (nfr.md H3, H7, OPS-1; ADR-0011, ADR-0012), and
 * making the first admin token (ADR-0006). No case here connects to anything, so these runs send
 * nothing anywhere.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { apiTokenStore } from "../src/store/api-tokens";
import { openDatabase } from "../src/store/database";

const MainScript = join(import.meta.dir, "..", "src", "main.ts");
const folder = mkdtempSync(join(tmpdir(), "ehserver-main-"));
const UsageExitCode = 64;
const RefusedConfigExitCode = 78;
const TestPassword = "test-proxy-password-1";

afterAll(() => rmSync(folder, { recursive: true, force: true }));

interface LogLine {
  readonly level: string;
  readonly event: string;
  readonly problem?: string;
  readonly problems?: readonly string[];
}

/** A configuration file with the egress table given. */
function configFile(name: string, egress: string): string {
  const path = join(folder, `${name}.toml`);
  writeFileSync(path, `data_dir = "data"\n\n[egress]\n${egress}\n`);
  return path;
}

/** Runs main.ts to its end, without the NO_PROXY of this machine unless the test sets one. */
function run(args: readonly string[], env: Readonly<Record<string, string>> = {}) {
  const inherited = { ...process.env };
  delete inherited.NO_PROXY;
  delete inherited.no_proxy;
  const ended = Bun.spawnSync([process.execPath, MainScript, ...args], {
    env: { ...inherited, ...env },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 20_000,
  });
  return {
    exitCode: ended.exitCode,
    stdout: ended.stdout.toString(),
    stderr: ended.stderr.toString(),
  };
}

/** Runs main.ts to its end and reads its log lines. */
function start(args: readonly string[], env: Readonly<Record<string, string>> = {}) {
  const { exitCode, stdout, stderr } = run(args, env);
  const lines = stdout
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as LogLine);
  return { exitCode, lines, output: `${stdout}${stderr}` };
}

describe("main", () => {
  test("H7: a proxy on this machine's network stops the server before it starts", () => {
    const path = configFile(
      "home",
      'profile = "proxy:home"\nurl = "http://ehserver@192.168.1.2:3128"\npassword_env = "EHSERVER_TEST_PROXY_PASSWORD"',
    );

    const { exitCode, lines, output } = start(["--config", path], {
      EHSERVER_TEST_PROXY_PASSWORD: TestPassword,
    });

    expect(exitCode).toBe(RefusedConfigExitCode);
    expect(lines).toEqual([
      expect.objectContaining({
        level: "error",
        event: "proxy refused",
        proxy: "home",
        problem: "the proxy host 192.168.1.2 is at 192.168.1.2, not a public address",
      }),
    ]);
    expect(output).not.toContain(TestPassword);
  });

  test("H7: NO_PROXY stops the server before it starts", () => {
    const path = configFile("vps", 'profile = "proxy:vps"\nurl = "http://203.0.113.7:8888"');

    const { exitCode, lines } = start(["--config", path], { NO_PROXY: "e-hentai.org" });

    expect(exitCode).toBe(RefusedConfigExitCode);
    expect(lines[0]?.problem).toStartWith("NO_PROXY and no_proxy must be unset");
  });

  test("H3: a password written into the file stops the server and is not repeated", () => {
    const path = configFile(
      "written",
      'profile = "proxy:vps"\nurl = "http://ehserver:written-secret@203.0.113.7:8888"',
    );

    const { exitCode, lines, output } = start(["--config", path]);

    expect(exitCode).toBe(RefusedConfigExitCode);
    expect(lines[0]).toMatchObject({ event: "configuration refused" });
    expect(output).not.toContain("written-secret");
  });

  test("OPS-1: a configuration file that cannot be read stops the server", () => {
    const { exitCode, lines } = start(["--config", join(folder, "absent.toml")]);

    expect(exitCode).toBe(RefusedConfigExitCode);
    expect(lines[0]?.problems).toEqual([expect.stringMatching(/^cannot read /)]);
  });

  test("ADR-0006: create-admin-token prints the secret of a new admin token and nothing else", () => {
    const path = configFile("tokens", 'profile = "mock"\nurl = "http://127.0.0.1:7878"');

    const first = run(["--config", path, "create-admin-token", "admin"]);
    const second = run(["--config", path, "create-admin-token", "admin"]);

    expect(first.exitCode).toBe(0);
    expect(first.stdout).toMatch(/^ehs_[A-Za-z0-9_-]{43}\n$/);
    expect(second.stdout).toMatch(/^ehs_[A-Za-z0-9_-]{43}\n$/);
    expect(second.stdout).not.toBe(first.stdout);
    const db = openDatabase(join(folder, "data", "ehserver.db"));
    const tokens = apiTokenStore(db).list();
    db.close();
    expect(tokens).toEqual([
      expect.objectContaining({ name: "create-admin-token", scopes: ["admin"] }),
      expect.objectContaining({ name: "create-admin-token", scopes: ["admin"] }),
    ]);
    expect(tokens[1]?.userId).toBe(tokens[0]?.userId ?? "");
  });

  test("a user name the API would refuse is a usage error", () => {
    const path = configFile("refused-name", 'profile = "mock"\nurl = "http://127.0.0.1:7878"');

    const { exitCode, lines } = start(["--config", path, "create-admin-token", "Admin User"]);

    expect(exitCode).toBe(UsageExitCode);
    expect(lines).toEqual([
      expect.objectContaining({
        event: "user name refused",
        problems: ["user name: does not match ^[a-z0-9][a-z0-9_-]{0,31}$"],
      }),
    ]);
  });

  test.each<[name: string, args: readonly string[]]>([
    ["nothing", []],
    ["an option of the old command line", ["--data", "data"]],
    ["a command without its user name", ["--config", "ehserver.toml", "create-admin-token"]],
    ["an unknown command", ["--config", "ehserver.toml", "create-token", "admin"]],
  ])("a command line with %s is a usage error", (_name, args) => {
    const { exitCode, lines } = start(args);

    expect(exitCode).toBe(UsageExitCode);
    expect(lines[0]?.event).toStartWith("usage:");
  });
});
