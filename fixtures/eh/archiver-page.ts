import { escapeHtml, type Site, siteBase } from "./page-shell";

/** One of the two archives, as the page prints it. */
export interface ArchiveOption {
  /** `Free!`, `1,234 GP`, or `N/A` when the site does not offer it. */
  readonly cost: string;
  /** `12.34 MiB`, or `N/A`. */
  readonly size: string;
}

export interface ArchiverPage {
  readonly site: Site;
  readonly gid: number;
  readonly token: string;
  /** The archiver key some pages add to the form address as `or`. */
  readonly archiverKey: string | null;
  /** E-Hentai prints the account's funds; null leaves them out, as ExHentai does. */
  readonly funds: { readonly gp: string; readonly credits: string } | null;
  readonly original: ArchiveOption;
  readonly resample: ArchiveOption;
}

const NotOffered = "N/A";
/** The H@H downloader's resolutions, which the parser does not read. */
const HathResolutions = ["780", "980", "1280", "1600", "2400", "org"];

export function archiverPageHtml(overrides: Partial<ArchiverPage> = {}): string {
  const page: ArchiverPage = {
    site: "ex",
    gid: 9000001,
    token: "a1b2c3d4e5",
    archiverKey: "123456-0123456789abcdef0123456789abcdef01234567",
    funds: null,
    original: { cost: "Free!", size: "24.68 MiB" },
    resample: { cost: "Free!", size: "3.21 MiB" },
    ...overrides,
  };
  const key = page.archiverKey === null ? "" : `&amp;or=${page.archiverKey}`;
  const action = `${siteBase(page.site)}archiver.php?gid=${page.gid}&amp;token=${page.token}${key}`;
  const funds =
    page.funds === null
      ? ""
      : `<p>Current Funds:</p><p>${page.funds.gp} GP [<a href="https://ehwiki.org/wiki/Gallery_Points" target="ehwiki">?</a>] &nbsp; ${page.funds.credits} Credits [<a href="https://ehwiki.org/wiki/Credits" target="ehwiki">?</a>]</p>`;
  return popupShell(
    page.site,
    `<h1 style="font-size:10pt; font-weight:bold">Sample Gallery Title</h1>${funds}<div style="position:relative; width:370px; margin:4px auto 4px; padding-top:3px">${optionColumn(page.original, "org", action)}${optionColumn(page.resample, "res", action)}<div style="clear:both"></div></div>${hathDownloader(action)}`,
  );
}

/** What the archiver answers to a download request, before it sends the browser on. */
export function archiveLocatingPageHtml(
  archiveUrl = "https://abcdefghijklmnopqrst.hath.network/archive/9000001/0123456789abcdef0123456789abcdef01234567/a1b2c3d4e5f/0",
  site: Site = "ex",
): string {
  return popupShell(
    site,
    `<p>Locating archive server and preparing file for download...</p><p>(this can take several minutes)</p><p id="continue">(<a href="${archiveUrl}" onclick="gotonext(); return false">Click here if your browser does not continue automatically</a>)</p><p>[ <a href="javascript:window.close()">Close</a> ]</p><script type="text/javascript">function gotonext() { document.getElementById("continue").innerHTML = "Please wait..."; document.location = "${archiveUrl}"; } setTimeout("gotonext()", 1);</script>`,
  );
}

/** The archiver opens as a popup: no navigation bar, everything inside `#db`. */
function popupShell(site: Site, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<title>Archiver</title>
<link rel="stylesheet" type="text/css" href="${siteBase(site)}z/0372/x.css" />
<meta http-equiv="Content-type" content="text/html; charset=UTF-8" />
<meta name="robots" content="noindex,nofollow" />
</head>
<body>
<div id="db">${body}</div>
</body>
</html>
`;
}

/** Original on the left, resample on the right; a column the site does not offer is greyed out. */
function optionColumn(option: ArchiveOption, type: "org" | "res", action: string): string {
  const isOffered = option.cost !== NotOffered;
  const label = type === "org" ? "Download Original Archive" : "Download Resample Archive";
  const side = type === "org" ? "left" : "right";
  const greyed = isOffered ? "" : "; color:#CCCCCC";
  const disabled = isOffered
    ? ""
    : ' title="This gallery does not currently qualify for a resample archive." disabled="disabled"';
  return `<div style="width:180px; float:${side}${greyed}"><div style="text-align:center; margin-top:4px">Download Cost: &nbsp; <strong>${escapeHtml(option.cost)}</strong></div><form action="${action}" method="post"><input type="hidden" name="dltype" value="${type}" /><div style="margin:3px auto"><input type="submit" name="dlcheck" value="${label}" style="width:180px"${disabled} /></div></form><p>Estimated Size: &nbsp; <strong>${escapeHtml(option.size)}</strong></p></div>`;
}

function hathDownloader(action: string): string {
  const cells = HathResolutions.map(
    (resolution) =>
      `<td style="font-weight:bold; width:70px; height:62px"><p><a href="#" onclick="return do_hathdl('${resolution}')">${resolution === "org" ? "Original" : `${resolution}x`}</a></p><p>1.00 MiB</p><p>Free</p></td>`,
  ).join("");
  return `<div style="position:relative; margin:4px auto 4px; padding-top:3px"><p style="font-weight:bold">H@H Downloader</p><form id="hathdl_form" action="${action}" method="post"><input type="hidden" id="hathdl_xres" name="hathdl_xres" value="" /></form><table style="margin:auto"><tr>${cells}</tr></table></div>`;
}
