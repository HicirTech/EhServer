/**
 * The "Image Limits" box of `home.php`: whose limit applies, how much is used, and what a reset or
 * unlock costs (wiki: Limits-and-Anti-Crawling, section 1). Every sentence of the box must be one
 * of the known wordings, because the governor acts on what this says.
 */
import { normalizeSpace, readInteger } from "./decoders";
import { attribute, type Element, find, findAll, nextElement, parseHtml, text } from "./html";
import {
  isUnrecognized,
  type ParseResult,
  success,
  type Unrecognized,
  unrecognized,
} from "./parse-result";

export interface ImageLimitsReading {
  /** Whose limit applies; `unknown` in the wording before 2024-08, which does not say. */
  readonly mode: "account" | "ip" | "unknown";
  /** Present only when the page states them. */
  readonly used?: number;
  readonly limit?: number;
  /** GP to reset the quota. */
  readonly resetCost?: number;
  /** GP to unlock a 24-hour quota that stays with the cookie. */
  readonly unlockCost?: number;
  /** Whether the IP is held to lower resolutions; the wording before 2024-08 never says. */
  readonly restrictedToLowResolution: "yes" | "no" | "unknown";
  /** The value the box's form posts; the reset or unlock must send exactly this. */
  readonly resetButton: string;
}

interface Facts {
  mode?: "account" | "ip";
  isCurrentWording?: true;
  isRestricted?: true;
  used?: number | undefined;
  limit?: number | undefined;
  resetCost?: number | undefined;
  unlockCost?: number | undefined;
}

/** Each known sentence and the facts it states. */
const Sentences: readonly [pattern: RegExp, facts: (numbers: number[]) => Facts][] = [
  [
    /^Due to widespread usage of bulk downloaders, high-resolution images can be limited\.$/,
    () => ({ isCurrentWording: true }),
  ],
  [
    /^You are currently at ([\d,]+) towards your account limit of ([\d,]+)\.$/,
    ([used, limit]) => ({ mode: "account", used, limit }),
  ],
  [
    /^You are currently at ([\d,]+) towards a limit of ([\d,]+)\.$/,
    ([used, limit]) => ({ used, limit }),
  ],
  [/^You can reset your image quota by spending ([\d,]+) GP\.$/, ([resetCost]) => ({ resetCost })],
  [/^Reset Cost: ([\d,]+) GP$/, ([resetCost]) => ({ resetCost })],
  [
    /^Due to a high request rate, your IP is currently restricted to lower-resolution images\.$/,
    () => ({ mode: "ip", isRestricted: true }),
  ],
  [
    /^You can get a Bronze Star or the More Pages hathperk to tie image limits to your account\.$/,
    () => ({ mode: "ip" }),
  ],
  [
    /^Alternatively, you can unlock a high-resolution quota for 24 hours by spending ([\d,]+) GP\.$/,
    ([unlockCost]) => ({ unlockCost }),
  ],
  [
    /^Note that for the latter, clearing your cookies will revert you to IP-based limits\.$/,
    () => ({}),
  ],
];

export function parseHomePage(html: string): ParseResult<ImageLimitsReading> {
  const document = parseHtml(html);
  const heading = findAll("h2", document).find(
    (h2) => normalizeSpace(text(h2) ?? "") === "Image Limits",
  );
  const box = heading === undefined ? null : nextElement(heading);
  if (box === null || !(attribute(box, "class") ?? "").split(" ").includes("homebox")) {
    return unrecognized("h2 Image Limits + div.homebox");
  }

  const facts = readFacts(box);
  if (isUnrecognized(facts)) {
    return facts;
  }

  const resetButton = attribute(find('input[name="reset_imagelimit"]', box), "value");
  if (resetButton === undefined) {
    return unrecognized('div.homebox input[name="reset_imagelimit"]');
  }

  return success({
    mode: facts.mode ?? "unknown",
    ...(facts.used === undefined ? {} : { used: facts.used }),
    ...(facts.limit === undefined ? {} : { limit: facts.limit }),
    ...(facts.resetCost === undefined ? {} : { resetCost: facts.resetCost }),
    ...(facts.unlockCost === undefined ? {} : { unlockCost: facts.unlockCost }),
    restrictedToLowResolution: facts.isRestricted
      ? "yes"
      : facts.isCurrentWording
        ? "no"
        : "unknown",
    resetButton,
  });
}

function readFacts(box: Element): Facts | Unrecognized {
  const facts: Facts = {};
  const sentences = findAll("p", box)
    .map((paragraph) => normalizeSpace(text(paragraph) ?? ""))
    .filter((sentence) => sentence !== "");
  for (const sentence of sentences) {
    const known = readSentence(sentence);
    if (known === null) {
      return unrecognized("div.homebox p", sentence);
    }

    if (known.mode !== undefined && facts.mode !== undefined && known.mode !== facts.mode) {
      return unrecognized("div.homebox: account and IP limits at once", sentence);
    }

    Object.assign(facts, known);
  }

  return facts;
}

function readSentence(sentence: string): Facts | null {
  for (const [pattern, facts] of Sentences) {
    const match = pattern.exec(sentence);
    if (match !== null) {
      const numbers = match.slice(1).map((group) => readInteger(group) ?? Number.NaN);
      return numbers.some(Number.isNaN) ? null : facts(numbers);
    }
  }

  return null;
}
