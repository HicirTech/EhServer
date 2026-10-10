/**
 * An egress sends upstream requests over one network path (ADR-0005); only the governor calls it.
 * Redirects are not followed: a redirect is an answer to classify, not a page.
 */
import type { UpstreamResponse } from "../eh-core/envelope";
import { siteHost, type UpstreamRequest } from "../eh-core/upstream-request";

export type EgressProfile = "mock" | "probe" | "direct" | `proxy:${string}`;

export interface Egress {
  readonly id: string;
  readonly profile: EgressProfile;
  send(request: UpstreamRequest, signal: AbortSignal): Promise<UpstreamResponse>;
}

/** The mock serves `https://<host><target>` at `<mock url>/<host><target>` (mock/README.md). */
export function mockEgress(mockUrl: string): Egress {
  return {
    id: "mock",
    profile: "mock",
    send: async (request, signal) => {
      const url = `${mockUrl}/${siteHost(request.site)}${request.target}`;
      const response = await fetch(url, { signal, redirect: "manual" });
      return {
        site: request.site,
        status: response.status,
        headers: response.headers,
        body: await response.text(),
      };
    },
  };
}
