/** The "Image Limits" box of `home.php` (nfr.md TEST-2; REL-1 and H5). */
import { describe, expect, test } from "bun:test";

import { detailPageHtml } from "../../fixtures/eh/detail-page";
import { homePageHtml } from "../../fixtures/eh/home-page";
import { parseHomePage } from "../../src/eh-core/home-page";

describe("parseHomePage", () => {
  test("TEST-2: reads an account limit, its use and the reset cost", () => {
    expect(parseHomePage(homePageHtml({ wording: "account" }))).toEqual({
      kind: "success",
      value: {
        mode: "account",
        used: 321,
        limit: 50000,
        resetCost: 642,
        restrictedToLowResolution: "no",
        resetButton: "Reset Quota",
      },
    });
  });

  test("TEST-2: reads an IP held to lower resolutions and the cost of a 24-hour quota", () => {
    expect(parseHomePage(homePageHtml({ wording: "ipRestricted" }))).toEqual({
      kind: "success",
      value: {
        mode: "ip",
        unlockCost: 20000,
        restrictedToLowResolution: "yes",
        resetButton: "Unlock Quota",
      },
    });
  });

  test("TEST-2: an IP limit without the restriction sentence is not restricted", () => {
    expect(parseHomePage(homePageHtml({ wording: "ip" }))).toMatchObject({
      value: { mode: "ip", restrictedToLowResolution: "no" },
    });
  });

  test("TEST-2: the wording before 2024-08 does not say whose limit it is", () => {
    expect(
      parseHomePage(homePageHtml({ wording: "legacy", used: "1,234", limit: "5,000" })),
    ).toEqual({
      kind: "success",
      value: {
        mode: "unknown",
        used: 1234,
        limit: 5000,
        resetCost: 642,
        restrictedToLowResolution: "unknown",
        resetButton: "Reset Limit",
      },
    });
  });

  test("REL-1, H5: a sentence nobody has seen in the box is unrecognized", () => {
    const html = homePageHtml().replace(
      "<p>You can reset",
      "<p>Your quota is under review.</p><p>You can reset",
    );

    expect(parseHomePage(html)).toEqual({
      kind: "unrecognized",
      marker: "div.homebox p",
      raw: "Your quota is under review.",
    });
  });

  test("REL-1, H5: account and IP sentences in one box are unrecognized", () => {
    const html = homePageHtml({ wording: "account" }).replace(
      "<p>You can reset",
      "<p>You can get a Bronze Star or the More Pages hathperk to tie image limits to your account.</p><p>You can reset",
    );

    expect(parseHomePage(html)).toMatchObject({
      kind: "unrecognized",
      marker: "div.homebox: account and IP limits at once",
    });
  });

  test("REL-1, H5: a page without the Image Limits box is unrecognized", () => {
    expect(parseHomePage(detailPageHtml())).toMatchObject({ kind: "unrecognized" });
  });

  test("REL-1, H5: a box without its reset button is unrecognized", () => {
    const html = homePageHtml().replace('name="reset_imagelimit"', 'name="other"');

    expect(parseHomePage(html)).toMatchObject({
      kind: "unrecognized",
      marker: 'div.homebox input[name="reset_imagelimit"]',
    });
  });
});
