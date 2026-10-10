import { selectAll, selectOne } from "css-select";
import { type AnyNode, type ChildNode, type Element, isTag } from "domhandler";
import { getAttributeValue, textContent } from "domutils";

export function find(selector: string, root: AnyNode): Element | null {
  return selectOne<AnyNode, Element>(selector, root);
}

export function findAll(selector: string, root: AnyNode): Element[] {
  return selectAll<AnyNode, Element>(selector, root);
}

/** All text inside the element; htmlparser2 has already decoded entities. */
export function text(element: Element | null): string | undefined {
  return element === null ? undefined : textContent(element);
}

export function attribute(element: Element | null, name: string): string | undefined {
  return element === null ? undefined : getAttributeValue(element, name);
}

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
