/** The archiver and its answer to a download request (nfr.md TEST-2; REL-1 and H5). */
import { describe, expect, test } from "bun:test";

import { archiveLocatingPageHtml, archiverPageHtml } from "../../fixtures/eh/archiver-page";
import { logOnPageHtml } from "../../fixtures/eh/log-on-page";
import { parseArchiveLocatingPage } from "../../src/eh-core/archive-locating-page";
import { parseArchiverPage } from "../../src/eh-core/archiver-page";

const Expected = { gid: 9000001, token: "a1b2c3d4e5" };
const ExAction =
  "https://exhentai.org/archiver.php?gid=9000001&token=a1b2c3d4e5&or=123456-0123456789abcdef0123456789abcdef01234567";
const ArchiveUrl =
  "https://abcdefghijklmnopqrst.hath.network/archive/9000001/0123456789abcdef0123456789abcdef01234567/a1b2c3d4e5f/0";
const MiB = 1024 ** 2;

describe("parseArchiverPage", () => {
  test("TEST-2: reads both archives when they are free, and no funds, as on ExHentai", () => {
    expect(parseArchiverPage(archiverPageHtml(), Expected)).toEqual({
      kind: "success",
      value: {
        original: {
          cost: 0,
          estimatedSize: Math.round(24.68 * MiB),
          form: {
            action: ExAction,
            fields: { dltype: "org", dlcheck: "Download Original Archive" },
          },
        },
        resample: {
          cost: 0,
          estimatedSize: Math.round(3.21 * MiB),
          form: {
            action: ExAction,
            fields: { dltype: "res", dlcheck: "Download Resample Archive" },
          },
        },
      },
    });
  });

  test("TEST-2: reads a GP cost, the funds and a resample not offered, as on E-Hentai", () => {
    const html = archiverPageHtml({
      site: "eh",
      archiverKey: null,
      funds: { gp: "12,345", credits: "67,890" },
      original: { cost: "1,234 GP", size: "1.50 GiB" },
      resample: { cost: "N/A", size: "N/A" },
    });

    expect(parseArchiverPage(html, Expected)).toEqual({
      kind: "success",
      value: {
        original: {
          cost: 1234,
          estimatedSize: Math.round(1.5 * 1024 * MiB),
          form: {
            action: "https://e-hentai.org/archiver.php?gid=9000001&token=a1b2c3d4e5",
            fields: { dltype: "org", dlcheck: "Download Original Archive" },
          },
        },
        resample: null,
        funds: { gp: 12345, credits: 67890 },
      },
    });
  });

  test("TEST-2: a page that asks to log on is the signed_out failure", () => {
    expect(parseArchiverPage(logOnPageHtml(), Expected)).toEqual({
      kind: "failure",
      code: "signed_out",
      message: "",
    });
  });

  test("REL-1, H5: the archiver of another gallery is unrecognized", () => {
    expect(parseArchiverPage(archiverPageHtml({ gid: 9000002 }), Expected)).toMatchObject({
      kind: "unrecognized",
      marker: "#db form[action]",
    });
  });

  test("REL-1, H5: a cost in another form is unrecognized", () => {
    const html = archiverPageHtml({ original: { cost: "Insufficient Funds", size: "24.68 MiB" } });

    expect(parseArchiverPage(html, Expected)).toEqual({
      kind: "unrecognized",
      marker: "Download Cost:",
      raw: "Insufficient Funds",
    });
  });

  test("REL-1, H5: a size in an unknown unit is unrecognized", () => {
    const html = archiverPageHtml({ original: { cost: "Free!", size: "24.68 MB" } });

    expect(parseArchiverPage(html, Expected)).toEqual({
      kind: "unrecognized",
      marker: "Estimated Size:",
      raw: "24.68 MB",
    });
  });

  test("REL-1, H5: an archive marked N/A whose button still works is unrecognized", () => {
    const html = archiverPageHtml({ resample: { cost: "N/A", size: "N/A" } }).replace(
      ' disabled="disabled"',
      "",
    );

    expect(parseArchiverPage(html, Expected)).toEqual({
      kind: "unrecognized",
      marker: '#db input[name="dltype"][value="res"] N/A',
      raw: "N/A",
    });
  });

  test("REL-1, H5: funds in another form are unrecognized", () => {
    const html = archiverPageHtml({ funds: { gp: "plenty", credits: "1" } });

    expect(parseArchiverPage(html, Expected)).toEqual({
      kind: "unrecognized",
      marker: "Current Funds:",
      raw: "plenty GP [?] 1 Credits [?]",
    });
  });

  test("REL-1, H5: a page without the resample column is unrecognized", () => {
    const html = archiverPageHtml().replace(
      /<div style="width:180px; float:right">.*?<\/p><\/div>/,
      "",
    );

    expect(parseArchiverPage(html, Expected)).toEqual({
      kind: "unrecognized",
      marker: '#db input[name="dltype"][value="res"]',
      raw: "",
    });
  });
});

describe("parseArchiveLocatingPage", () => {
  test("TEST-2: reads the address of the archive server", () => {
    expect(parseArchiveLocatingPage(archiveLocatingPageHtml())).toEqual({
      kind: "success",
      value: { archiveUrl: ArchiveUrl },
    });
  });

  test("TEST-2: a page that asks to log on is the signed_out failure", () => {
    expect(parseArchiveLocatingPage(logOnPageHtml())).toMatchObject({
      kind: "failure",
      code: "signed_out",
    });
  });

  test("REL-1, H5: an address that is not an archive server's is unrecognized", () => {
    expect(parseArchiveLocatingPage(archiveLocatingPageHtml("https://0"))).toEqual({
      kind: "unrecognized",
      marker: "#continue a[href]",
      raw: "https://0",
    });
  });

  test("REL-1, H5: the archiver page is not its answer", () => {
    expect(parseArchiveLocatingPage(archiverPageHtml())).toEqual({
      kind: "unrecognized",
      marker: "#db > p",
      raw: "",
    });
  });
});
