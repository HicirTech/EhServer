import { pageShell, type Site } from "./page-shell";

/** Unconfirmed shape: clients only know the paragraph `This page requires you to log on.</p>`. */
export function logOnPageHtml(site: Site = "eh"): string {
  return pageShell(site, "<p>This page requires you to log on.</p>");
}
