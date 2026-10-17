/**
 * Checks a proxy egress before the server starts (nfr.md H7, ADR-0011). A request must never leave
 * from this machine's own connection, so no NO_PROXY may let Bun's fetch go around the proxy, the
 * proxy must not sit on this machine or its network, and it must accept connections. Nothing is
 * sent to the site or to any other service.
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { createConnection, isIP } from "node:net";

export interface ProxyCheckOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Every address the host resolves to. */
  readonly lookup?: (host: string) => Promise<readonly string[]>;
  /** Resolves once a TCP connection is open, and closes it. */
  readonly connect?: (host: string, port: number) => Promise<void>;
}

const ProxyConnectTimeoutMs = 5_000;
const ProxySchemes: readonly string[] = ["http:", "https:"];
const BypassVariables = ["NO_PROXY", "no_proxy"];

/** IPv4 ranges that are this machine, its network or no host at all (RFC 6890 and successors). */
const NonPublicIpv4: readonly (readonly [base: string, prefixLength: number])[] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** Why the proxy may not be used, or null. Never names the proxy's credentials. */
export async function proxyEgressProblem(
  proxyUrl: URL,
  { env = process.env, lookup = resolveAll, connect = openAndClose }: ProxyCheckOptions = {},
): Promise<string | null> {
  if (!ProxySchemes.includes(proxyUrl.protocol)) {
    return `the proxy must be http:// or https://, not ${proxyUrl.protocol}//`;
  }

  if (BypassVariables.some((name) => (env[name] ?? "") !== "")) {
    return "NO_PROXY and no_proxy must be unset: Bun's fetch sends matching requests without the proxy";
  }

  const host = proxyUrl.hostname.replace(/^\[(.*)\]$/, "$1");
  let addresses: readonly string[];
  try {
    addresses = isIP(host) === 0 ? await lookup(host) : [host];
  } catch {
    return `the proxy host ${host} does not resolve`;
  }

  const local = addresses.filter((address) => !isPublicAddress(address));
  if (local.length > 0) {
    return `the proxy host ${host} is at ${local.join(", ")}, not a public address`;
  }

  const port = proxyPort(proxyUrl);
  try {
    await connect(host, port);
  } catch {
    return `the proxy at ${host}:${port} does not accept connections`;
  }

  return null;
}

export function isPublicAddress(address: string): boolean {
  switch (isIP(address)) {
    case 4:
      return isPublicIpv4(ipv4Value(address));
    case 6:
      return isPublicIpv6(address);
    default:
      return false;
  }
}

export function openAndClose(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port, timeout: ProxyConnectTimeoutMs });
    socket.once("connect", () => {
      socket.destroy();
      resolve();
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`no connection within ${ProxyConnectTimeoutMs} ms`));
    });
    socket.once("error", reject);
  });
}

async function resolveAll(host: string): Promise<readonly string[]> {
  return (await dnsLookup(host, { all: true })).map((entry) => entry.address);
}

function proxyPort(proxyUrl: URL): number {
  if (proxyUrl.port !== "") {
    return Number(proxyUrl.port);
  }

  return proxyUrl.protocol === "https:" ? 443 : 80;
}

function ipv4Value(address: string): number {
  return address.split(".").reduce((value, octet) => value * 256 + Number(octet), 0);
}

function isPublicIpv4(value: number): boolean {
  return NonPublicIpv4.every(([base, prefixLength]) => {
    const size = 2 ** (32 - prefixLength);
    return Math.floor(value / size) !== Math.floor(ipv4Value(base) / size);
  });
}

/** Not public: unspecified, loopback, NAT64, unique local, link-local, multicast, mapped private. */
function isPublicIpv6(address: string): boolean {
  const groups = ipv6Groups(address);
  if (groups === null) {
    return false;
  }

  const [first = 0, second = 0] = groups;
  const isZero = (from: number, to: number) => groups.slice(from, to).every((group) => group === 0);
  if (isZero(0, 5) && groups[5] === 0xffff) {
    return isPublicIpv4((groups[6] ?? 0) * 0x10000 + (groups[7] ?? 0));
  }

  return !(
    (isZero(0, 7) && (groups[7] ?? 0) <= 1) ||
    (first === 0x64 && second === 0xff9b && isZero(2, 6)) ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00
  );
}

/** The eight 16-bit groups; null for an address the URL parser refuses, such as one with a zone. */
function ipv6Groups(address: string): number[] | null {
  let host: string;
  try {
    host = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  } catch {
    return null;
  }

  const [head = "", tail] = host.split("::");
  const left = head === "" ? [] : head.split(":");
  const right = tail === undefined || tail === "" ? [] : tail.split(":");
  const middle = tail === undefined ? [] : Array<string>(8 - left.length - right.length).fill("0");
  return [...left, ...middle, ...right].map((group) => Number.parseInt(group, 16));
}
