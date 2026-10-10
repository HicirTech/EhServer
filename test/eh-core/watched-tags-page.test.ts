/** The My Tags page (nfr.md TEST-2: success, empty and failure fixtures; REL-1 and H5). */
import { describe, expect, test } from "bun:test";

import { favoritesPageHtml } from "../../fixtures/eh/favorites-page";
import { logOnPageHtml } from "../../fixtures/eh/log-on-page";
import { userTag, watchedTagsPageHtml } from "../../fixtures/eh/watched-tags-page";
import { parseWatchedTagsPage } from "../../src/eh-core/watched-tags-page";

describe("parseWatchedTagsPage", () => {
  test("TEST-2: reads each tag with its flags, colour and weight, and skips the new-tag row", () => {
    const html = watchedTagsPageHtml({
      tags: [
        userTag(),
        userTag({
          id: 102,
          tag: "language:sample language",
          watched: false,
          hidden: true,
          color: "#a1B2c3",
          weight: -5,
        }),
      ],
    });

    expect(parseWatchedTagsPage(html)).toEqual({
      kind: "success",
      value: {
        tags: [
          {
            id: 101,
            tag: { namespace: "female", name: "sample tag" },
            watched: true,
            hidden: false,
            color: null,
            weight: 10,
          },
          {
            id: 102,
            tag: { namespace: "language", name: "sample language" },
            watched: false,
            hidden: true,
            color: "#a1B2c3",
            weight: -5,
          },
        ],
      },
    });
  });

  test("TEST-2: a tag set whose count says 0 is a recognized empty result", () => {
    expect(parseWatchedTagsPage(watchedTagsPageHtml({ tags: [] }))).toEqual({
      kind: "empty",
      reason: "noTags",
    });
  });

  test("TEST-2: a page that asks to log on is the signed_out failure", () => {
    expect(parseWatchedTagsPage(logOnPageHtml())).toEqual({
      kind: "failure",
      code: "signed_out",
      message: "",
    });
  });

  test("REL-1, H5: no tags under a tag set that counts some is unrecognized", () => {
    expect(parseWatchedTagsPage(watchedTagsPageHtml({ tags: [], tagSetCount: 3 }))).toEqual({
      kind: "unrecognized",
      marker: "#tagset_outer option[selected]",
      raw: "Tagset #1 (3)",
    });
  });

  test("REL-1, H5: a row that is not a tag entry is unrecognized", () => {
    const html = watchedTagsPageHtml().replace('<div id="usertag_101">', '<div id="usertag_x">');

    expect(parseWatchedTagsPage(html)).toEqual({
      kind: "unrecognized",
      marker: "#usertags_outer > div[id]",
      raw: "usertag_x",
    });
  });

  test("REL-1, H5: a tag without its namespace is unrecognized", () => {
    const html = watchedTagsPageHtml({ tags: [userTag({ tag: "sample tag" })] });

    expect(parseWatchedTagsPage(html)).toEqual({
      kind: "unrecognized",
      marker: "#tagpreview_101[title]",
      raw: "sample tag",
    });
  });

  test("REL-1, H5: a colour that is not #rrggbb is unrecognized", () => {
    const html = watchedTagsPageHtml({ tags: [userTag({ color: "blue" })] });

    expect(parseWatchedTagsPage(html)).toEqual({
      kind: "unrecognized",
      marker: "#tagcolor_101[value]",
      raw: "blue",
    });
  });

  test("REL-1, H5: a missing watched box is unrecognized", () => {
    const html = watchedTagsPageHtml().replace('id="tagwatch_101"', 'id="tagwatch-101"');

    expect(parseWatchedTagsPage(html)).toMatchObject({
      kind: "unrecognized",
      marker: "#tagwatch_101",
    });
  });

  test("REL-1, H5: another account page is not the My Tags page", () => {
    expect(parseWatchedTagsPage(favoritesPageHtml())).toEqual({
      kind: "unrecognized",
      marker: "#usertags_outer",
      raw: "",
    });
  });
});
