/**
 * The archiver's answer to a download request: "Locating archive server…", which sends the browser
 * on to the archive server. Only that address is read.
 */
import { normalizeSpace, readArchiveUrl } from "./decoders";
import { attribute, find, parseHtml, text } from "./html";
import { isLogOnPage } from "./log-on";
import { failure, type ParseResult, success, unrecognized } from "./parse-result";

export interface ArchiveLocatingReading {
  readonly archiveUrl: string;
}

const LocatingText = "Locating archive server and preparing file for download...";

export function parseArchiveLocatingPage(html: string): ParseResult<ArchiveLocatingReading> {
  const document = parseHtml(html);
  if (isLogOnPage(document)) {
    return failure("signed_out");
  }

  const first = normalizeSpace(text(find("#db > p", document)) ?? "");
  if (first !== LocatingText) {
    return unrecognized("#db > p", first);
  }

  const href = attribute(find("#continue a", document), "href");
  const archiveUrl = readArchiveUrl(href);
  return archiveUrl === null
    ? unrecognized("#continue a[href]", href ?? "")
    : success({ archiveUrl });
}
