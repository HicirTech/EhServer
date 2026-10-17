/** The one configuration file (nfr.md OPS-1, H3, H7; ADR-0012). */
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { type ConfigReading, readConfig } from "../../src/config/config";

const ConfigDir = resolve(join("srv", "ehserver"));
const TestPassword = "123e4567-e89b-12d3-a456-426614174000";

/** A configuration with the egress table given. */
function config(egress: string, top = 'data_dir = "data"'): string {
  return `${top}\n\n[egress]\n${egress}\n`;
}

const MockEgress = 'profile = "mock"\nurl = "http://127.0.0.1:7878"';
const ProxyEgress =
  'profile = "proxy:vps"\nurl = "http://ehserver@203.0.113.7:8888"\npassword_env = "PROXY_PASSWORD"';

function problems(reading: ConfigReading): readonly string[] {
  return reading.kind === "refused" ? reading.problems : [];
}

describe("readConfig", () => {
  test("OPS-1: a mock configuration reads, with the data folder beside the file", () => {
    const reading = readConfig(config(MockEgress), ConfigDir, {});

    expect(reading).toEqual({
      kind: "valid",
      config: {
        dataDir: resolve(ConfigDir, "data"),
        listen: undefined,
        port: undefined,
        egress: { profile: "mock", url: "http://127.0.0.1:7878" },
      },
    });
  });

  test("H3: a proxy's password comes from the variable the file names", () => {
    const top = 'data_dir = "/var/lib/ehserver"\nlisten = "0.0.0.0"\nport = 8081';

    const reading = readConfig(config(ProxyEgress, top), ConfigDir, {
      PROXY_PASSWORD: TestPassword,
    });

    expect(reading.kind).toBe("valid");
    if (reading.kind === "valid") {
      const { dataDir, listen, port, egress } = reading.config;
      expect({ dataDir, listen, port }).toEqual({
        dataDir: resolve(ConfigDir, "/var/lib/ehserver"),
        listen: "0.0.0.0",
        port: 8081,
      });
      expect(egress).toMatchObject({ profile: "proxy:vps", name: "vps" });
      expect(egress.profile !== "mock" && egress.url.username).toBe("ehserver");
      expect(egress.profile !== "mock" && egress.url.password).toBe(TestPassword);
      expect(egress.profile !== "mock" && egress.url.host).toBe("203.0.113.7:8888");
    }
  });

  test("a proxy without a password variable keeps its address as written", () => {
    const reading = readConfig(
      config('profile = "proxy:vps"\nurl = "http://203.0.113.7:8888"'),
      ConfigDir,
      {},
    );

    expect(reading.kind === "valid" && reading.config.egress).toMatchObject({
      profile: "proxy:vps",
      name: "vps",
      url: new URL("http://203.0.113.7:8888"),
    });
  });

  test.each<[name: string, text: string, env: Record<string, string>, problems: string[]]>([
    [
      "a misspelt key",
      config(MockEgress, 'dat_dir = "data"'),
      {},
      ["$: missing required data_dir", "$: undeclared property dat_dir"],
    ],
    ["no egress", 'data_dir = "data"\n', {}, ["$: missing required egress"]],
    [
      "a port out of range",
      config(MockEgress, 'data_dir = "data"\nport = 70000'),
      {},
      ["$.port: above the maximum 65535"],
    ],
    [
      "an egress that is not built",
      config('profile = "direct"\nurl = "http://203.0.113.7:8888"'),
      {},
      ["$.egress.profile: does not match ^(mock|proxy:[a-z0-9][a-z0-9-]*)$"],
    ],
    [
      "a proxy that is not HTTP",
      config('profile = "proxy:vps"\nurl = "socks5://203.0.113.7:1080"'),
      {},
      ["$.egress.url: not an http:// or https:// URL"],
    ],
    [
      "a password for the mock",
      config(`${MockEgress}\npassword_env = "PROXY_PASSWORD"`),
      { PROXY_PASSWORD: TestPassword },
      ["$.egress.password_env: only a proxy takes a password"],
    ],
    [
      "an unset password variable",
      config(ProxyEgress),
      {},
      ["$.egress.password_env: PROXY_PASSWORD is not set"],
    ],
    [
      "an empty password variable",
      config(ProxyEgress),
      { PROXY_PASSWORD: "" },
      ["$.egress.password_env: PROXY_PASSWORD is not set"],
    ],
    [
      "a password without a user name",
      config(
        'profile = "proxy:vps"\nurl = "http://203.0.113.7:8888"\npassword_env = "PROXY_PASSWORD"',
      ),
      { PROXY_PASSWORD: TestPassword },
      ["$.egress.url: needs the user name before @ when a password is given"],
    ],
  ])("OPS-1: %s is refused", (_name, text, env, expected) => {
    expect(problems(readConfig(text, ConfigDir, env))).toEqual(expected);
  });

  test("H3: a password written into the file is refused without being repeated", () => {
    const text = config(
      'profile = "proxy:vps"\nurl = "http://ehserver:written-secret@203.0.113.7:8888"',
    );

    const refusal = problems(readConfig(text, ConfigDir, {}));

    expect(refusal).toEqual([
      "$.egress.url: holds a password; name the variable that holds it in password_env instead",
    ]);
    expect(refusal.join(" ")).not.toContain("written-secret");
  });

  test("a file that is not TOML is refused with the parser's reason", () => {
    expect(problems(readConfig("port = = 1", ConfigDir, {}))).toEqual([
      expect.stringMatching(/^not TOML: /),
    ]);
  });
});
