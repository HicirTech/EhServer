/** The start-up check of a proxy egress (nfr.md H7; ADR-0011). */
import { describe, expect, test } from "bun:test";

import { isPublicAddress, openAndClose, proxyEgressProblem } from "../../src/egress/proxy-check";

/** RFC 5737 and RFC 3849 documentation addresses stand in for a VPS on the internet. */
const VpsProxy = new URL("http://user:secret@203.0.113.7:8888");

/** Records every connection the check opens, and opens none. */
function connections() {
  const opened: string[] = [];
  return {
    opened,
    connect: async (host: string, port: number) => {
      opened.push(`${host}:${port}`);
    },
  };
}

describe("isPublicAddress", () => {
  test.each<[address: string, isPublic: boolean]>([
    ["203.0.113.7", true],
    ["172.32.0.1", true],
    ["100.128.0.1", true],
    ["2001:db8::7", true],
    ["::ffff:203.0.113.7", true],
    ["10.1.2.3", false],
    ["172.16.0.1", false],
    ["172.31.255.255", false],
    ["192.168.1.10", false],
    ["127.0.0.1", false],
    ["100.64.0.1", false],
    ["169.254.10.1", false],
    ["0.0.0.0", false],
    ["224.0.0.1", false],
    ["255.255.255.255", false],
    ["::", false],
    ["::1", false],
    ["fd12:3456::1", false],
    ["fe80::1", false],
    ["fe80::1%eth0", false],
    ["ff02::1", false],
    ["::ffff:192.168.1.10", false],
    ["64:ff9b::a00:1", false],
    ["vps.example", false],
  ])("H7: %s is public: %p", (address, isPublic) => {
    expect(isPublicAddress(address)).toBe(isPublic);
  });
});

describe("proxyEgressProblem", () => {
  test("H7: a proxy on a public address that accepts connections may be used", async () => {
    const { opened, connect } = connections();

    const problem = await proxyEgressProblem(VpsProxy, { env: {}, connect });

    expect(problem).toBeNull();
    expect(opened).toEqual(["203.0.113.7:8888"]);
  });

  test.each<[name: string, env: Record<string, string>]>([
    ["NO_PROXY", { NO_PROXY: "e-hentai.org" }],
    ["no_proxy", { no_proxy: "*" }],
  ])("H7: %s set stops the check before anything is connected", async (_name, env) => {
    const { opened, connect } = connections();

    const problem = await proxyEgressProblem(VpsProxy, { env, connect });

    expect(problem).toBe(
      "NO_PROXY and no_proxy must be unset: Bun's fetch sends matching requests without the proxy",
    );
    expect(opened).toEqual([]);
  });

  test.each<[url: string, address: string]>([
    ["http://127.0.0.1:8888", "127.0.0.1"],
    ["http://user:secret@192.168.1.2:3128", "192.168.1.2"],
    ["http://[::1]:8888", "::1"],
  ])("H7: a proxy at %s is refused without connecting to it", async (url, address) => {
    const { opened, connect } = connections();

    const problem = await proxyEgressProblem(new URL(url), { env: {}, connect });

    expect(problem).toBe(`the proxy host ${address} is at ${address}, not a public address`);
    expect(opened).toEqual([]);
  });

  test("H7: a host name is checked by every address it resolves to", async () => {
    const { opened, connect } = connections();
    const lookup = async () => ["203.0.113.7", "192.168.1.2"];

    const problem = await proxyEgressProblem(new URL("http://vps.example:8888"), {
      env: {},
      lookup,
      connect,
    });

    expect(problem).toBe("the proxy host vps.example is at 192.168.1.2, not a public address");
    expect(opened).toEqual([]);
  });

  test("a host name that does not resolve is refused", async () => {
    const lookup = async (): Promise<readonly string[]> => {
      throw new Error("ENOTFOUND");
    };

    const problem = await proxyEgressProblem(new URL("http://vps.example:8888"), {
      env: {},
      lookup,
      connect: connections().connect,
    });

    expect(problem).toBe("the proxy host vps.example does not resolve");
  });

  test("a proxy that does not accept connections is refused", async () => {
    const connect = async () => {
      throw new Error("ECONNREFUSED");
    };

    const problem = await proxyEgressProblem(VpsProxy, { env: {}, connect });

    expect(problem).toBe("the proxy at 203.0.113.7:8888 does not accept connections");
  });

  test("only HTTP and HTTPS proxies are taken, the only ones fetch has", async () => {
    const problem = await proxyEgressProblem(new URL("socks5://203.0.113.7:1080"), {
      env: {},
      connect: connections().connect,
    });

    expect(problem).toBe("the proxy must be http:// or https://, not socks5://");
  });

  test.each<[url: string, opened: string]>([
    ["http://203.0.113.7", "203.0.113.7:80"],
    ["https://203.0.113.7", "203.0.113.7:443"],
  ])("a proxy without a port is tried at its scheme's: %s", async (url, expected) => {
    const { opened, connect } = connections();

    await proxyEgressProblem(new URL(url), { env: {}, connect });

    expect(opened).toEqual([expected]);
  });
});

describe("openAndClose", () => {
  test("resolves once a connection opens", async () => {
    const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });

    await expect(openAndClose("127.0.0.1", listener.port)).resolves.toBeUndefined();
    listener.stop(true);
  });

  test("rejects when nothing listens", async () => {
    const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
    const port = listener.port;
    listener.stop(true);

    await expect(openAndClose("127.0.0.1", port)).rejects.toThrow();
  });
});
