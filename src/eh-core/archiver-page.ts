/**
 * The archiver `archiver.php?gid=<gid>&token=<token>`: what an original and a resample archive cost,
 * about how large each is, and the form that starts its download; E-Hentai also shows the account's
 * funds. The H@H downloader below them needs the account's own client and is not read.
 */
import type { GalleryRef } from "../domain/gallery";
import {
  normalizeSpace,
  readArchiverLink,
  readFileSize,
  readGpAndCredits,
  readGpCost,
} from "./decoders";
import { attribute, type Document, type Element, find, findAll, parseHtml, text } from "./html";
import { isLogOnPage } from "./log-on";
import {
  assembling,
  failure,
  isUnrecognized,
  need,
  type ParseResult,
  success,
} from "./parse-result";

export interface ArchiveOptionReading {
  /** GP; 0 when free. */
  readonly cost: number;
  /** In bytes, from the size the page rounds. */
  readonly estimatedSize: number;
  /** The form that starts the download, with the fields to post. */
  readonly form: { readonly action: string; readonly fields: Readonly<Record<string, string>> };
}

export interface ArchiverPageReading {
  /** Null when the site does not offer it now. */
  readonly original: ArchiveOptionReading | null;
  readonly resample: ArchiveOptionReading | null;
  /** Present when the page shows them. */
  readonly funds?: { readonly gp: number; readonly credits: number };
}

type ArchiveType = "org" | "res";

const CostLabel = "Download Cost:";
const SizeLabel = "Estimated Size:";
const FundsLabel = "Current Funds:";
const NotOffered = "N/A";

/** `expected` is the gallery requested; every form on the page must be for it. */
export function parseArchiverPage(
  html: string,
  expected: GalleryRef,
): ParseResult<ArchiverPageReading> {
  const document = parseHtml(html);
  if (isLogOnPage(document)) {
    return failure("signed_out");
  }

  const reading = assembling(() => {
    for (const form of findAll("#db form", document)) {
      const action = attribute(form, "action");
      const gallery = readArchiverLink(action);
      const isExpected = gallery?.gid === expected.gid && gallery.token === expected.token;
      need(isExpected ? action : null, "#db form[action]", action);
    }

    return {
      original: readOption(document, "org"),
      resample: readOption(document, "res"),
      ...readFunds(document),
    };
  });
  return isUnrecognized(reading) ? reading : success(reading);
}

/** A column holds the cost, the form and the size; `N/A` in all three says it is not offered. */
function readOption(document: Document, type: ArchiveType): ArchiveOptionReading | null {
  const typeField = `input[name="dltype"][value="${type}"]`;
  const marker = `#db ${typeField}`;
  const column = need(
    findAll("#db > div > div", document).find((element) => find(typeField, element) !== null),
    marker,
    "",
  );
  const cost = readLabelled(find(":scope > div", column), CostLabel);
  const size = readLabelled(find(":scope > p", column), SizeLabel);
  const button = need(find('input[name="dlcheck"]', column), `${marker} dlcheck`, "");
  const isEnabled = attribute(button, "disabled") === undefined;
  if (cost === NotOffered) {
    need(size === NotOffered && !isEnabled ? cost : null, `${marker} ${NotOffered}`, size);
    return null;
  }

  const action = attribute(find("form", column), "action");
  const dlcheck = attribute(button, "value");
  return {
    cost: need(readGpCost(cost), CostLabel, cost),
    estimatedSize: need(readFileSize(size), SizeLabel, size),
    form: {
      action: need(action, `${marker} form[action]`, ""),
      fields: {
        dltype: type,
        dlcheck: need(isEnabled ? dlcheck : null, `${marker} dlcheck`, dlcheck),
      },
    },
  };
}

function readLabelled(element: Element | null, label: string): string {
  const value = normalizeSpace(text(element) ?? "");
  return need(value.startsWith(`${label} `) ? value.slice(label.length + 1) : null, label, value);
}

function readFunds(document: Document): { funds?: { gp: number; credits: number } } {
  const paragraphs = findAll("#db > p", document).map((paragraph) =>
    normalizeSpace(text(paragraph) ?? ""),
  );
  const label = paragraphs.indexOf(FundsLabel);
  if (label < 0) {
    return {};
  }

  const value = paragraphs[label + 1];
  return { funds: need(readGpAndCredits(value), FundsLabel, value) };
}
