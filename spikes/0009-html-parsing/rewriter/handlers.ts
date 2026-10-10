import { decodeHTML, decodeHTMLAttribute } from "entities";

type Handlers = HTMLRewriterTypes.HTMLRewriterElementContentHandlers;

/** Calls `onText` once per matched element with all text inside it, entities decoded. */
export function collectText(onText: (text: string) => void): Handlers {
  return collectChunks((chunks) => onText(decodeHTML(chunks.join(""))));
}

/** Script bodies are not HTML-escaped, so they are passed on as they are. */
export function collectRawText(onText: (text: string) => void): Handlers {
  return collectChunks((chunks) => onText(chunks.join("")));
}

/** HTMLRewriter hands out text in chunks, even inside one text node. */
function collectChunks(onEnd: (chunks: readonly string[]) => void): Handlers {
  let chunks: string[] = [];
  return {
    element(element) {
      chunks = [];
      element.onEndTag(() => onEnd(chunks));
    },
    text(text) {
      chunks.push(text.text);
    },
  };
}

/** HTMLRewriter returns attribute values still escaped. */
export function attribute(element: HTMLRewriterTypes.Element, name: string): string | undefined {
  const value = element.getAttribute(name);
  return value === null ? undefined : decodeHTMLAttribute(value);
}

/** The record a nested handler writes into: its parent's handler created it a moment before. */
export function current<T>(records: readonly T[]): T {
  const record = records.at(-1);
  if (record === undefined) {
    throw new Error("A nested handler ran outside the element that owns its record.");
  }

  return record;
}
