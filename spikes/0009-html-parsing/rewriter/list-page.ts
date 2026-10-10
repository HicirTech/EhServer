import { assembleListPage } from "../assemble-list";
import { newListPage, newListRow } from "../raw";
import type { ListParse } from "../readings";
import { attribute, collectText, current } from "./handlers";

export function parseListPage(html: string): ListParse {
  const page = newListPage();
  const row = () => current(page.rows);
  new HTMLRewriter()
    .on("table.itg", {
      element(table) {
        page.tableClass ??= attribute(table, "class") ?? "";
      },
    })
    .on("table.itg tr", {
      element() {
        page.rows.push(newListRow());
      },
    })
    .on("table.itg tr th", {
      element() {
        row().isHeader = true;
      },
    })
    .on(
      "table.itg tr td[colspan]",
      collectText((text) => (row().message ??= text)),
    )
    .on("table.itg tr td.gl3c a", {
      element(link) {
        row().href ??= attribute(link, "href");
      },
    })
    .on(
      "table.itg tr td.gl3c div.glink",
      collectText((text) => (row().title ??= text)),
    )
    .on(
      "table.itg tr td.gl1c div.cn",
      collectText((text) => (row().category ??= text)),
    )
    .on(
      'table.itg tr td.gl2c div[id^="posted_"]',
      collectText((text) => (row().posted ??= text)),
    )
    .on("table.itg tr td.gl2c > div > div.ir", {
      element(stars) {
        row().ratingStyle ??= attribute(stars, "style");
      },
    })
    .on("table.itg tr td.gl2c div.glthumb img", {
      element(image) {
        row().thumbnail ??= attribute(image, "data-src") ?? attribute(image, "src");
      },
    })
    .on(
      "table.itg tr td.gl4c a",
      collectText((text) => (row().uploader ??= text)),
    )
    .on(
      "table.itg tr td.gl4c > div:nth-child(2)",
      collectText((text) => (row().pages ??= text)),
    )
    .on("table.itg tr td.gl3c div.gt", {
      element(tag) {
        row().tags.push(attribute(tag, "title") ?? "");
      },
    })
    .on(
      "div.searchtext",
      collectText((text) => (page.searchText ??= text)),
    )
    .on("#uprev", {
      element(link) {
        page.prev ??= { tagName: link.tagName, href: attribute(link, "href") };
      },
    })
    .on("#unext", {
      element(link) {
        page.next ??= { tagName: link.tagName, href: attribute(link, "href") };
      },
    })
    .transform(html);
  return assembleListPage(page);
}
