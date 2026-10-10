import type { Element } from "domhandler";
import { parseDocument } from "htmlparser2";

import { assembleListPage } from "../assemble-list";
import type { RawListRow, RawPagerLink } from "../raw";
import type { ListParse } from "../readings";
import { attribute, find, findAll, text } from "./elements";

export function parseListPage(html: string): ListParse {
  const document = parseDocument(html);
  const table = find("table.itg", document);
  return assembleListPage({
    tableClass: attribute(table, "class"),
    rows: table === null ? [] : findAll("tr", table).map(collectRow),
    searchText: text(find("div.searchtext", document)),
    prev: pagerLink(find("#uprev", document)),
    next: pagerLink(find("#unext", document)),
  });
}

function collectRow(row: Element): RawListRow {
  const image = find("td.gl2c div.glthumb img", row);
  return {
    isHeader: find("th", row) !== null,
    message: text(find("td[colspan]", row)),
    href: attribute(find("td.gl3c a", row), "href"),
    title: text(find("td.gl3c div.glink", row)),
    category: text(find("td.gl1c div.cn", row)),
    posted: text(find('td.gl2c div[id^="posted_"]', row)),
    ratingStyle: attribute(find("td.gl2c > div > div.ir", row), "style"),
    thumbnail: attribute(image, "data-src") ?? attribute(image, "src"),
    uploader: text(find("td.gl4c a", row)),
    pages: text(find("td.gl4c > div:nth-child(2)", row)),
    tags: findAll("td.gl3c div.gt", row).map((tag) => attribute(tag, "title") ?? ""),
  };
}

function pagerLink(element: Element | null): RawPagerLink | undefined {
  return element === null ? undefined : { tagName: element.name, href: attribute(element, "href") };
}
