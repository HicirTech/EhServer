import { decodeHTML } from "entities";

import { assembleDetailPage } from "../assemble-detail";
import { newDetailPage } from "../raw";
import type { DetailParse } from "../readings";
import { attribute, collectRawText, collectText, current } from "./handlers";

export function parseDetailPage(html: string): DetailParse {
  const page = newDetailPage();
  const metadataRow = () => current(page.metadata);
  const tagGroup = () => current(page.tagGroups);
  const comment = () => current(page.comments);
  let bodyChunks: string[] = [];
  new HTMLRewriter()
    .on(
      "script",
      collectRawText((text) => page.scripts.push(text)),
    )
    .on(
      "p",
      collectText((text) => page.paragraphs.push(text)),
    )
    .on(
      "div.d p",
      collectText((text) => (page.errorBox ??= text)),
    )
    .on(
      "#gn",
      collectText((text) => (page.title ??= text)),
    )
    .on(
      "#gj",
      collectText((text) => (page.titleJpn ??= text)),
    )
    .on(
      "#gdc div.cs",
      collectText((text) => (page.category ??= text)),
    )
    .on(
      '#gdn a[href*="/uploader/"]',
      collectText((text) => (page.uploader ??= text)),
    )
    .on("#gdd tr", {
      element() {
        page.metadata.push({});
      },
    })
    .on(
      "#gdd tr td.gdt1",
      collectText((text) => (metadataRow().label ??= text)),
    )
    .on(
      "#gdd tr td.gdt2",
      collectText((text) => (metadataRow().value ??= text)),
    )
    .on("#gdd tr td.gdt2 a", {
      element(link) {
        metadataRow().href ??= attribute(link, "href");
      },
    })
    .on(
      "#rating_label",
      collectText((text) => (page.ratingLabel ??= text)),
    )
    .on(
      "#rating_count",
      collectText((text) => (page.ratingCount ??= text)),
    )
    .on("#taglist tr", {
      element() {
        page.tagGroups.push({ names: [] });
      },
    })
    .on(
      "#taglist tr td.tc",
      collectText((text) => (tagGroup().namespace ??= text)),
    )
    .on(
      '#taglist tr div[id^="td_"] a',
      collectText((text) => tagGroup().names.push(text)),
    )
    .on(
      "#gd5 a",
      collectText((text) => page.actionTexts.push(text)),
    )
    .on(
      "div.gtb p.gpc",
      collectText((text) => (page.showing ??= text)),
    )
    .on("#gdt a", {
      element(link) {
        page.previewHrefs.push(attribute(link, "href") ?? "");
      },
    })
    .on("#cdiv div.c1", {
      element() {
        page.comments.push({ body: "" });
      },
    })
    .on(
      "#cdiv div.c1 div.c3",
      collectText((text) => (comment().header ??= text)),
    )
    .on(
      "#cdiv div.c1 div.c3 a",
      collectText((text) => (comment().author ??= text)),
    )
    .on(
      "#cdiv div.c1 div.c5 span",
      collectText((text) => (comment().score ??= text)),
    )
    .on("#cdiv div.c1 div.c6", {
      element(body) {
        bodyChunks = [];
        comment().elementId = attribute(body, "id");
        body.onEndTag(() => {
          comment().body = decodeHTML(bodyChunks.join(""));
        });
      },
      text(text) {
        bodyChunks.push(text.text);
      },
    })
    .on("#cdiv div.c1 div.c6 br", {
      element() {
        bodyChunks.push("\n");
      },
    })
    .on(
      "#cdiv div.c1 div.c8 strong",
      collectText((text) => (comment().edited ??= text)),
    )
    .transform(html);
  return assembleDetailPage(page);
}
