/**
 * Starting EhServer from the command line (nfr.md H7; ADR-0011). Every case here is refused before
 * anything is connected, so these runs send nothing anywhere.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MainScript = join(import.meta.dir, "..", "src", "main.ts");
const dataDir = mkdtempSync(join(tmpdir(), "ehserver-main-"));
const UsageExitCode = 64;
const RefusedProxyExitCode = 78;

afterAll(() => rmSync(dataDir, { recursive: true, force: true }));

interface LogLine {
  readonly level: string;
  readonly event: string;
  readonly problem?: string;
}

/** Runs main.ts to its end, without the NO_PROXY of this machine unless the test sets one. */
function start(args: readonly string[], env: Readonly<Record<string, string>> = {}) {
  const inherited = { ...process.env };
  delete inherited.NO_PROXY;
  delete inherited.no_proxy;
  const run = Bun.spawnSync([process.execPath, MainScript, "--data", dataDir, ...args], {
    env: { ...inherited, ...env },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 20_000,
  });
  const output = run.stdout.toString();
  const lines = output
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as LogLine);
  return { exitCode: run.exitCode, lines, output: `${output}${run.stderr.toString()}` };
}

describe("main", () => {
  test("H7: a proxy on this machine's network stops the server before it starts", () => {
    const { exitCode, lines, output } = start([
      "--proxy",
      "home=http://user:secret@192.168.1.2:3128",
    ]);

    expect(exitCode).toBe(RefusedProxyExitCode);
    expect(lines).toEqual([
      expect.objectContaining({
        level: "error",
        event: "proxy refused",
        proxy: "home",
        problem: "the proxy host 192.168.1.2 is at 192.168.1.2, not a public address",
      }),
    ]);
    expect(output).not.toContain("secret");
  });

  test("H7: NO_PROXY stops the server before it starts", () => {
    const { exitCode, lines } = start(["--proxy", "vps=http://203.0.113.7:8888"], {
      NO_PROXY: "e-hentai.org",
    });

    expect(exitCode).toBe(RefusedProxyExitCode);
    expect(lines[0]?.problem).toStartWith("NO_PROXY and no_proxy must be unset");
  });

  test.each<[name: string, args: readonly string[]]>([
    ["no egress", []],
    ["both egresses", ["--mock", "http://127.0.0.1:1", "--proxy", "vps=http://203.0.113.7:8888"]],
    ["a proxy without its address", ["--proxy", "vps"]],
    ["a proxy name with spaces", ["--proxy", "my vps=http://203.0.113.7:8888"]],
  ])("a command line with %s is a usage error", (_name, args) => {
    const { exitCode, lines } = start(args);

    expect(exitCode).toBe(UsageExitCode);
    expect(lines[0]?.event).toStartWith("usage:");
  });
});
