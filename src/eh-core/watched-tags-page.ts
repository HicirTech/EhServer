/**
 * The My Tags page `mytags`: the tags of the tag set shown, each watched, hidden or neither, with
 * its colour and weight. The row `usertag_0` is the form for a new tag, not a tag.
 */
import type { Tag } from "../domain/gallery";
import { readHexColor, readInteger, readSignedInteger, readTag, readTagSetCount } from "./decoders";
import { attribute, type Element, find, findAll, parseHtml, text } from "./html";
import { isLogOnPage } from "./log-on";
import {
  assembling,
  empty,
  failure,
  isUnrecognized,
  need,
  type ParseResult,
  success,
  unrecognized,
} from "./parse-result";

export interface WatchedTagReading {
  /** The site's id for the entry, which changing or removing it needs. */
  readonly id: number;
  readonly tag: Tag;
  readonly watched: boolean;
  readonly hidden: boolean;
  /** `#rrggbb`, or null for the default colour. */
  readonly color: string | null;
  readonly weight: number;
}

export interface WatchedTagsPageReading {
  readonly tags: readonly WatchedTagReading[];
}

export type WatchedTagsPageEmpty = "noTags";

const NewTagId = 0;

export function parseWatchedTagsPage(
  html: string,
): ParseResult<WatchedTagsPageReading, WatchedTagsPageEmpty> {
  const document = parseHtml(html);
  if (isLogOnPage(document)) {
    return failure("signed_out");
  }

  const outer = find("#usertag_form #usertags_outer", document);
  if (outer === null) {
    return unrecognized("#usertags_outer");
  }

  const tags = assembling(() => findAll(":scope > div", outer).flatMap(readRow));
  if (isUnrecognized(tags)) {
    return tags;
  }

  if (tags.length > 0) {
    return success({ tags });
  }

  const tagSet = text(find("#tagset_outer option[selected]", document));
  return readTagSetCount(tagSet) === 0
    ? empty("noTags")
    : unrecognized("#tagset_outer option[selected]", tagSet);
}

function readRow(row: Element): WatchedTagReading[] {
  const rowId = attribute(row, "id");
  const id = need(
    readInteger(/^usertag_(\d+)$/.exec(rowId ?? "")?.[1]),
    "#usertags_outer > div[id]",
    rowId,
  );
  return id === NewTagId ? [] : [readTagRow(row, id)];
}

function readTagRow(row: Element, id: number): WatchedTagReading {
  const title = attribute(find(`#tagpreview_${id}`, row), "title");
  const color = attribute(find(`#tagcolor_${id}`, row), "value");
  const weight = attribute(find(`#tagweight_${id}`, row), "value");
  return {
    id,
    tag: need(readTag(title), `#tagpreview_${id}[title]`, title),
    watched: readChecked(row, `#tagwatch_${id}`),
    hidden: readChecked(row, `#taghide_${id}`),
    color: color === "" ? null : need(readHexColor(color), `#tagcolor_${id}[value]`, color),
    weight: need(readSignedInteger(weight), `#tagweight_${id}[value]`, weight),
  };
}

function readChecked(row: Element, selector: string): boolean {
  return attribute(need(find(selector, row), selector, ""), "checked") !== undefined;
}
