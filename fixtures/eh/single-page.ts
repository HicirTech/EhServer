import { escapeHtml, pageShell, type Site, siteBase } from "./page-shell";

/** A single page `/s/<pageToken>/<gid>-<number>`, in the forms the site prints. */
export interface SinglePage {
  readonly site: Site;
  readonly gid: number;
  readonly galleryToken: string;
  readonly number: number;
  readonly pageToken: string;
  readonly showkey: string;
  /** The H@H address of the image, or the quota image when the limit is reached. */
  readonly imageUrl: string;
  readonly fileName: string;
  readonly width: number;
  readonly height: number;
  readonly sizeText: string;
  /** The `nl` key that asks for another image server. */
  readonly reloadKey: string;
  /** Where the page puts the "Download original" link: `#i6` since 2023-10, `#i7` before. */
  readonly originalIn: "i6" | "i7" | null;
  readonly originalKey: string;
}

export function singlePage(overrides: Partial<SinglePage> = {}): SinglePage {
  return {
    site: "eh",
    gid: 9000001,
    galleryToken: "a1b2c3d4e5",
    number: 3,
    pageToken: "0a0a0a0a03",
    showkey: "s4mpl3k3y0a",
    imageUrl:
      "http://198.51.100.7:2688/h/0123456789abcdef0123456789abcdef01234567-345678-1280-1810-jpg/keystamp=1788265440-0a1b2c3d4e;fileindex=1234567;xres=1280/sample_003.jpg",
    fileName: "sample_003.jpg",
    width: 1280,
    height: 1810,
    sizeText: "337.6 KB",
    reloadKey: "12345-678901",
    originalIn: "i6",
    originalKey: "0a1b2c3d4e5",
    ...overrides,
  };
}

export function singlePageHtml(overrides: Partial<SinglePage> = {}): string {
  const page = singlePage(overrides);
  const base = siteBase(page.site);
  const pageUrl = (number: number, token: string) => `${base}s/${token}/${page.gid}-${number}`;
  const original = `<img src="https://ehgt.org/g/mr.gif" class="mr" /> <a href="${base}fullimg.php?gid=${page.gid}&amp;page=${page.number}&amp;key=${page.originalKey}">Download original 2560 x 3620 2.4 MB source</a>`;
  const i6Original = page.originalIn === "i6" ? ` &nbsp; ${original}` : "";
  const i7 = page.originalIn === "i7" ? ` &nbsp; ${original}` : "";
  const name = escapeHtml(page.fileName);
  return pageShell(
    page.site,
    `<div id="i1" class="sni" style="width:1300px"><h1>Sample Gallery</h1><div id="i2"><div class="sn"><a id="prev" onclick="return load_image(${page.number - 1}, '0a0a0a0a02')" href="${pageUrl(page.number - 1, "0a0a0a0a02")}"><img src="https://ehgt.org/g/p.png" /></a><div><span>${page.number}</span> / <span>24</span></div><a id="next" onclick="return load_image(${page.number + 1}, '0a0a0a0a04')" href="${pageUrl(page.number + 1, "0a0a0a0a04")}"><img src="https://ehgt.org/g/n.png" /></a></div><div>${name} :: ${page.width} x ${page.height} :: ${page.sizeText}</div></div><div id="i3"><a onclick="return load_image(${page.number + 1}, '0a0a0a0a04')" href="${pageUrl(page.number + 1, "0a0a0a0a04")}"><img id="img" src="${page.imageUrl}" style="width:${page.width}px;height:${page.height}px" onerror="this.onerror=null; nl('${page.reloadKey}')" /></a></div><div id="i4"><div>${name} :: ${page.width} x ${page.height} :: ${page.sizeText}</div></div><div id="i5"><div class="sb"><a href="${base}g/${page.gid}/${page.galleryToken}/"><img src="https://ehgt.org/g/b.png" referrerpolicy="no-referrer" /></a></div></div><div id="i6" class="if"> &nbsp; <img src="https://ehgt.org/g/mr.gif" class="mr" /> <a href="${base}?f_shash=0123456789abcdef0123456789abcdef01234567">Show all galleries with this file</a>${i6Original} &nbsp; <img src="https://ehgt.org/g/mr.gif" class="mr" /> <a href="#" id="loadfail" onclick="return nl('${page.reloadKey}')">Click here if the image fails loading</a> </div><div id="i7" class="if">${i7}</div></div>
<script type="text/javascript">
var gid=${page.gid};
var startpage=${page.number};
var startkey="${page.pageToken}";
var showkey="${page.showkey}";
var base_url="${base}";
var api_url = "https://api.e-hentai.org/api.php";
var si=12345;
var xres = ${page.width};
var yres = ${page.height};
</script>`,
    "Sample Gallery - E-Hentai Galleries",
  );
}
