import { normalizeSpace } from "./decoders";
import { type Document, findAll, text } from "./html";

/** Account pages answer with this paragraph when the session is missing (outcome `signed_out`). */
const LogOnText = "This page requires you to log on.";

export function isLogOnPage(document: Document): boolean {
  return findAll("p", document).some(
    (paragraph) => normalizeSpace(text(paragraph) ?? "") === LogOnText,
  );
}
