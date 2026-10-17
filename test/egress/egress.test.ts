/** The egresses (ADR-0005: every upstream request goes through one; ADR-0011: the proxy egress). */
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";

import { FirstGid, galleryToken } from "../../mock/catalog";
import { startMock } from "../../mock/server";
import {
  EgressUnavailableError,
  mockEgress,
  proxyEgress,
  siteOrigin,
} from "../../src/egress/egress";

const mock = startMock();
const egress = mockEgress(mock.url);
const signal = () => AbortSignal.timeout(5_000);
/** The User-Agent the clients send, which the maintainer chose for EhServer (ADR-0011). */
const ClientBrowser =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";
/** Never resolves, so not even a fault could reach a real host. */
const PlainOrigin = () => "http://eh.invalid";
const TlsOrigin = () => "https://eh.invalid";
const stoppers: (() => void)[] = [];

afterAll(() => mock.stop());

beforeEach(() => mock.clearRequests());

afterEach(() => {
  for (const stop of stoppers.splice(0)) {
    stop();
  }
});

/** A proxy on this machine that connects nowhere: it records what it was asked, then answers. */
function fakeProxy(reply: string) {
  const asked: string[] = [];
  const listener = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      data(socket, data) {
        asked.push(new TextDecoder().decode(data));
        socket.write(reply);
        socket.end();
      },
    },
  });
  stoppers.push(() => listener.stop(true));
  return {
    asked,
    url: (credentials = "") => new URL(`http://${credentials}127.0.0.1:${listener.port}`),
  };
}

function closedPort(): number {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  return port;
}

describe("mockEgress", () => {
  test("asks the mock for the site's host and the request's path, and returns the answer", async () => {
    const response = await egress.send({ site: "eh", target: "/toplist.php?tl=15&p=1" }, signal());

    expect(response.status).toBe(200);
    expect(response.site).toBe("eh");
    expect(response.body).toContain("Galleries Yesterday");
    expect(mock.requests()).toEqual([
      { method: "GET", host: "e-hentai.org", path: "/toplist.php", query: "?tl=15&p=1" },
    ]);
  });

  test("ExHentai requests go to its own host", async () => {
    const target = `/g/${FirstGid}/${galleryToken(FirstGid)}/`;

    await egress.send({ site: "ex", target }, signal());

    expect(mock.requests()).toMatchObject([{ host: "exhentai.org", path: target }]);
  });

  test("an error status is an answer to classify, not an exception", async () => {
    const response = await egress.send({ site: "eh", target: "/toplist.php?tl=21" }, signal());

    expect(response.status).toBe(404);
  });
});

describe("proxyEgress", () => {
  test("ADR-0011: a page goes through the proxy, as the clients' browser, with the proxy's credentials", async () => {
    const proxy = fakeProxy("HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\npage");
    const vps = proxyEgress("vps", proxy.url("user:secret@"), PlainOrigin);

    const response = await vps.send({ site: "eh", target: "/toplist.php?tl=15" }, signal());

    const lines = proxy.asked[0]?.split("\r\n") ?? [];
    expect(response).toMatchObject({ site: "eh", status: 200, body: "page" });
    expect(lines[0]).toBe("GET http://eh.invalid/toplist.php?tl=15 HTTP/1.1");
    expect(lines).toContain(`Proxy-Authorization: Basic ${btoa("user:secret")}`);
    expect(lines).toContain(`User-Agent: ${ClientBrowser}`);
    expect(vps.id).toBe("proxy:vps");
  });

  test("ADR-0011: an HTTPS page is tunnelled to its host through the proxy", async () => {
    const proxy = fakeProxy("HTTP/1.1 200 Connection established\r\n\r\n");
    const vps = proxyEgress("vps", proxy.url(), TlsOrigin);

    const failure = await vps.send({ site: "eh", target: "/" }, signal()).catch((e: unknown) => e);

    expect(proxy.asked[0]?.split("\r\n")[0]).toBe("CONNECT eh.invalid:443 HTTP/1.1");
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(EgressUnavailableError);
  });

  test("H7: a proxy that does not accept connections fails the request, and nothing goes around it", async () => {
    const vps = proxyEgress("vps", new URL(`http://127.0.0.1:${closedPort()}`), TlsOrigin);

    const failure = await vps.send({ site: "eh", target: "/" }, signal()).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(EgressUnavailableError);
    expect(failure).toMatchObject({
      message: "proxy vps does not accept connections",
      cause: { code: "ConnectionRefused" },
    });
  });

  test.each<[name: string, reply: string]>([
    [
      "407, asking for credentials",
      'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="proxy"\r\nContent-Length: 0\r\n\r\n',
    ],
    [
      "401, as tinyproxy answers a wrong password",
      "HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n",
    ],
  ])("H7: a proxy that refuses the credentials with %s fails the request", async (_name, reply) => {
    const proxy = fakeProxy(reply);
    const vps = proxyEgress("vps", proxy.url("user:wrong@"), TlsOrigin);

    const failure = await vps.send({ site: "eh", target: "/" }, signal()).catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(EgressUnavailableError);
    expect(failure).toMatchObject({ message: "proxy vps refused the credentials" });
  });

  test("a redirect through the proxy is an answer to classify, not followed", async () => {
    const proxy = fakeProxy(
      "HTTP/1.1 302 Found\r\nLocation: http://eh.invalid/elsewhere\r\nContent-Length: 0\r\n\r\n",
    );
    const vps = proxyEgress("vps", proxy.url(), PlainOrigin);

    const response = await vps.send({ site: "eh", target: "/g/1/abc/" }, signal());

    expect(response.status).toBe(302);
    expect(proxy.asked).toHaveLength(1);
  });

  test("the site's pages are asked for over HTTPS at its own host", () => {
    expect([siteOrigin("eh"), siteOrigin("ex")]).toEqual([
      "https://e-hentai.org",
      "https://exhentai.org",
    ]);
  });
});
