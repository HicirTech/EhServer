/**
 * An egress sends upstream requests over one network path (ADR-0005); only the governor calls it.
 * Redirects are not followed: a redirect is an answer to classify, not a page.
 */
import type { Site, UpstreamResponse } from "../eh-core/envelope";
import { siteHost, type UpstreamRequest } from "../eh-core/upstream-request";

export type EgressProfile = "mock" | "probe" | "direct" | `proxy:${string}`;

export interface Egress {
  readonly id: string;
  readonly profile: EgressProfile;
  /** Rejects for a transport error, and with EgressUnavailableError when the egress itself fails. */
  send(request: UpstreamRequest, signal: AbortSignal): Promise<UpstreamResponse>;
}

/** The egress could not be used, so nothing reached the site (outcomes.md `egress_unavailable`). */
export class EgressUnavailableError extends Error {
  override readonly name = "EgressUnavailableError";
}

/** The browser the clients show the site (ADR-0011). */
const SiteHeaders: Readonly<Record<string, string>> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
};

/** How Bun's fetch reports a proxy it cannot reach (ADR-0011). */
const ProxyUnreachableCodes: ReadonlySet<string> = new Set(["ConnectionRefused", "ENOTFOUND"]);
/** 407, or 401 as tinyproxy answers a wrong password (ADR-0011). */
const ProxyRefusedCredentials: ReadonlySet<number> = new Set([401, 407]);

export function siteOrigin(site: Site): string {
  return `https://${siteHost(site)}`;
}

/** The mock serves `https://<host><target>` at `<mock url>/<host><target>` (mock/README.md). */
export function mockEgress(mockUrl: string): Egress {
  return {
    id: "mock",
    profile: "mock",
    send: async (request, signal) => {
      const url = `${mockUrl}/${siteHost(request.site)}${request.target}`;
      const response = await fetch(url, { signal, redirect: "manual", headers: SiteHeaders });
      return answer(request, response);
    },
  };
}

/**
 * Every request names the proxy, so none leaves without it (ADR-0011). A proxy that cannot be
 * reached, or refuses the credentials, fails the request; nothing is sent around it.
 */
export function proxyEgress(
  name: string,
  proxyUrl: URL,
  origin: (site: Site) => string = siteOrigin,
): Egress {
  const profile: EgressProfile = `proxy:${name}`;
  return {
    id: profile,
    profile,
    send: async (request, signal) => {
      let response: Response;
      try {
        response = await fetch(`${origin(request.site)}${request.target}`, {
          signal,
          redirect: "manual",
          headers: SiteHeaders,
          proxy: proxyUrl.href,
        });
      } catch (error) {
        throw isProxyUnreachable(error)
          ? new EgressUnavailableError(`proxy ${name} does not accept connections`, {
              cause: error,
            })
          : error;
      }

      if (ProxyRefusedCredentials.has(response.status)) {
        throw new EgressUnavailableError(`proxy ${name} refused the credentials`);
      }

      return answer(request, response);
    },
  };
}

async function answer(request: UpstreamRequest, response: Response): Promise<UpstreamResponse> {
  return {
    site: request.site,
    status: response.status,
    headers: response.headers,
    body: await response.text(),
  };
}

function isProxyUnreachable(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  return typeof code === "string" && ProxyUnreachableCodes.has(code);
}
