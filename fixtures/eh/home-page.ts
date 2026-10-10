import { pageShell, type Site } from "./page-shell";

/** The "Image Limits" box of `home.php`, in the wordings captured on the site. */
export type ImageLimitsWording =
  /** Captured 2024-08: the limit is tied to the account. */
  | "account"
  /** Captured 2025-06: IP-based, and the IP is held to lower resolutions. */
  | "ipRestricted"
  /** Unconfirmed: the 2025-06 box without the restriction sentence. */
  | "ip"
  /** Captured 2023-10, before the 2024-08 change. */
  | "legacy";

export interface HomePage {
  readonly site: Site;
  readonly wording: ImageLimitsWording;
  readonly used: string;
  readonly limit: string;
  readonly resetCost: string;
  readonly unlockCost: string;
}

const BulkDownloaders =
  "<p>Due to widespread usage of bulk downloaders, high-resolution images can be limited.</p>";

export function homePageHtml(overrides: Partial<HomePage> = {}): string {
  const page: HomePage = {
    site: "eh",
    wording: "account",
    used: "321",
    limit: "50,000",
    resetCost: "642",
    unlockCost: "20,000",
    ...overrides,
  };
  const boxes = [
    homebox("Image Limits", imageLimits(page)),
    homebox("EHTracker", "<p>Sample tracker statistics.</p>"),
    homebox("Total GP Gained", "<p>Sample GP statistics.</p>"),
    homebox("Toplists", "<p>Sample toplist placings.</p>"),
    homebox("Moderation Power", "<p>Sample moderation power.</p>"),
  ];
  return pageShell(
    page.site,
    `<div class="stuffbox">${boxes.join("")}</div>`,
    "E-Hentai Galleries: My Home",
  );
}

function homebox(heading: string, body: string): string {
  return `<h2>${heading}</h2><div class="homebox">${body}</div>`;
}

function imageLimits(page: HomePage): string {
  const button = (value: string) =>
    `<form action="" method="post"><p><input type="submit" name="reset_imagelimit" value="${value}" style="width:120px" /></p></form>`;
  const ipBox = (restricted: boolean) =>
    `${BulkDownloaders}${restricted ? "<p>Due to a high request rate, your IP is currently restricted to lower-resolution images.</p>" : ""}<p>You can get a Bronze Star or the More Pages hathperk to tie image limits to your account.</p><p>Alternatively, you can unlock a high-resolution quota for 24 hours by spending <strong>${page.unlockCost}</strong> GP.</p><p>Note that for the latter, clearing your cookies will revert you to IP-based limits.</p>${button("Unlock Quota")}`;
  switch (page.wording) {
    case "account":
      return `${BulkDownloaders}<p>You are currently at <strong>${page.used}</strong> towards your account limit of <strong>${page.limit}</strong>.</p><p>You can reset your image quota by spending <strong>${page.resetCost}</strong> GP.</p>${button("Reset Quota")}`;
    case "ipRestricted":
      return ipBox(true);
    case "ip":
      return ipBox(false);
    case "legacy":
      return `<p>You are currently at <strong>${page.used}</strong> towards a limit of <strong>${page.limit}</strong>.</p><p>Reset Cost: <strong>${page.resetCost}</strong> GP</p><form action="" method="post"><div><input type="submit" name="reset_imagelimit" value="Reset Limit" style="width:120px" /></div></form>`;
  }
}
