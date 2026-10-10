/** What to ask the site for. Only the egress turns it into a URL and sends it (ADR-0005). */
import type { Site } from "./envelope";

export interface UpstreamRequest {
  readonly site: Site;
  /** The path and query, as the site's own links spell them: `/toplist.php?tl=15&p=1`. */
  readonly target: string;
}

const SiteHosts: Readonly<Record<Site, string>> = {
  eh: "e-hentai.org",
  ex: "exhentai.org",
};

export function siteHost(site: Site): string {
  return SiteHosts[site];
}
