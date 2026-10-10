import type { Element } from "domhandler";
import { parseDocument } from "htmlparser2";

import { assembleDetailPage } from "../assemble-detail";
import type { RawComment } from "../raw";
import type { DetailParse } from "../readings";
import { attribute, find, findAll, text, textWithBreaks } from "./elements";

export function parseDetailPage(html: string): DetailParse {
  const document = parseDocument(html);
  const all = (selector: string) => findAll(selector, document);
  const first = (selector: string) => text(find(selector, document));
  return assembleDetailPage({
    scripts: all("script").map((script) => text(script) ?? ""),
    paragraphs: all("p").map((paragraph) => text(paragraph) ?? ""),
    errorBox: first("div.d p"),
    title: first("#gn"),
    titleJpn: first("#gj"),
    category: first("#gdc div.cs"),
    uploader: first('#gdn a[href*="/uploader/"]'),
    metadata: all("#gdd tr").map((row) => ({
      label: text(find("td.gdt1", row)),
      value: text(find("td.gdt2", row)),
      href: attribute(find("td.gdt2 a", row), "href"),
    })),
    ratingLabel: first("#rating_label"),
    ratingCount: first("#rating_count"),
    tagGroups: all("#taglist tr").map((row) => ({
      namespace: text(find("td.tc", row)),
      names: findAll('div[id^="td_"] a', row).map((link) => text(link) ?? ""),
    })),
    actionTexts: all("#gd5 a").map((link) => text(link) ?? ""),
    showing: first("div.gtb p.gpc"),
    previewHrefs: all("#gdt a").map((link) => attribute(link, "href") ?? ""),
    comments: all("#cdiv div.c1").map(collectComment),
  });
}

function collectComment(comment: Element): RawComment {
  const body = find("div.c6", comment);
  return {
    elementId: attribute(body, "id"),
    header: text(find("div.c3", comment)),
    author: text(find("div.c3 a", comment)),
    score: text(find("div.c5 span", comment)),
    body: body === null ? "" : textWithBreaks(body.children),
    edited: text(find("div.c8 strong", comment)),
  };
}
