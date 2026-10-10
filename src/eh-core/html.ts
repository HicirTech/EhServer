/** HTML access for eh-core: htmlparser2 with css-select (ADR-0009). */
import { selectAll, selectOne } from "css-select";
import { type AnyNode, type ChildNode, type Document, type Element, isTag } from "domhandler";
import { getAttributeValue, textContent } from "domutils";
import { parseDocument } from "htmlparser2";

export type { Document, Element };

export function parseHtml(html: string): Document {
  return parseDocument(html);
}

/** The first match, like `querySelector`. Selectors never name `tbody`: htmlparser2 adds none. */
export function find(selector: string, root: AnyNode): Element | null {
  return selectOne<AnyNode, Element>(selector, root);
}

export function findAll(selector: string, root: AnyNode): Element[] {
  return selectAll<AnyNode, Element>(selector, root);
}

/** All text inside the element, entities decoded. */
export function text(element: Element | null): string | undefined {
  return element === null ? undefined : textContent(element);
}

export function attribute(element: Element | null, name: string): string | undefined {
  return element === null ? undefined : getAttributeValue(element, name);
}

/** The text of these nodes with each `<br>` as a line break. */
export function textWithBreaks(nodes: readonly ChildNode[]): string {
  return nodes
    .map((node) => {
      if (!isTag(node)) {
        return textContent(node);
      }

      return node.name === "br" ? "\n" : textWithBreaks(node.children);
    })
    .join("");
}
