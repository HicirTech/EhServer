import { categoryDiv } from "./category";
import { escapeHtml, pageShell, type Site, siteBase } from "./page-shell";

export interface DetailComment {
  /** 0 is the uploader's comment. */
  readonly id: number;
  readonly author: string;
  /** As the site prints it, for example `25 September 2026, 08:20`. */
  readonly posted: string;
  /** Ignored for the uploader's comment, which has no score. */
  readonly score: string;
  /** Served as is: the caller escapes what needs escaping. */
  readonly bodyHtml: string;
  readonly edited: string | null;
}

export interface TagGroup {
  readonly namespace: string;
  readonly names: readonly string[];
}

/** A gallery page in the forms the site prints. */
export interface DetailPage {
  readonly site: Site;
  readonly gid: number;
  readonly token: string;
  /** -1 when the page was fetched without an account. */
  readonly apiuid: number;
  readonly apikey: string;
  readonly title: string;
  readonly titleJpn: string;
  readonly category: string;
  readonly uploader: string;
  readonly posted: string;
  readonly parent: { readonly gid: number; readonly token: string } | null;
  readonly visible: string;
  readonly language: string;
  readonly fileSize: string;
  readonly length: number;
  readonly favorited: string;
  /** Null prints "Not Yet Rated". */
  readonly ratingAverage: string | null;
  readonly ratingCount: number;
  readonly tags: readonly TagGroup[];
  readonly torrentCount: number;
  /** The gallery page number of the first preview on this page of previews. */
  readonly previewStart: number;
  /** The page tokens of the previews on this page, in order. */
  readonly previewPageTokens: readonly string[];
  readonly comments: readonly DetailComment[];
}

export function detailComment(overrides: Partial<DetailComment> = {}): DetailComment {
  return {
    id: 7000001,
    author: "sample commenter",
    posted: "26 September 2026, 09:15",
    score: "+12",
    bodyHtml: "Nice &amp; tidy.<br />Second line.",
    edited: null,
    ...overrides,
  };
}

export function detailPage(overrides: Partial<DetailPage> = {}): DetailPage {
  return {
    site: "eh",
    gid: 9000001,
    token: "a1b2c3d4e5",
    apiuid: -1,
    apikey: "0123456789abcdef0123",
    title: `[Sample Circle] Tom & Jerry's "Example" Gallery [English]`,
    titleJpn: "[サンプル] 例のギャラリー",
    category: "Doujinshi",
    uploader: "sample uploader",
    posted: "2026-09-01 12:34",
    parent: { gid: 8000001, token: "f6e5d4c3b2" },
    visible: "Yes",
    language: "English",
    fileSize: "12.5 MiB",
    length: 24,
    favorited: "57 times",
    ratingAverage: "4.46",
    ratingCount: 189,
    tags: [
      { namespace: "language", names: ["english", "translated"] },
      { namespace: "female", names: ["sample tag"] },
      { namespace: "artist", names: ["example artist"] },
    ],
    torrentCount: 2,
    previewStart: 1,
    previewPageTokens: ["0a0a0a0a01", "0a0a0a0a02", "0a0a0a0a03"],
    comments: [
      detailComment({
        id: 0,
        author: "sample uploader",
        posted: "01 September 2026, 12:34",
        bodyHtml: "Uploaded with care.",
      }),
      detailComment(),
    ],
    ...overrides,
  };
}

export function detailPageHtml(overrides: Partial<DetailPage> = {}): string {
  const page = detailPage(overrides);
  const base = siteBase(page.site);
  return pageShell(
    page.site,
    `${scriptVariables(page, base)}<div class="gm"><div id="gleft"><div id="gd1"><div style="width:250px; height:354px; background:transparent url(https://ehgt.org/t/0a/0a/0a0a0a0a01aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-111111-1280-1810-jpg_250.jpg) 0 0 no-repeat"></div></div></div><div id="gd2"><h1 id="gn">${escapeHtml(page.title)}</h1><h1 id="gj">${escapeHtml(page.titleJpn)}</h1></div><div id="gmid"><div id="gd3"><div id="gdc">${categoryDiv(page.category, "cs", base)}</div><div id="gdn"><a href="${base}uploader/${encodeURIComponent(page.uploader)}">${escapeHtml(page.uploader)}</a></div>${metadataTable(page, base)}${ratingBlock(page, base)}<div id="gdf" onclick="return pop_fav()"><div style="float:left; cursor:pointer" id="fav"></div><div style="float:left">&nbsp; <a id="favoritelink" href="#" onclick="return false"><img src="https://ehgt.org/g/mr.gif" /> Add to Favorites</a></div><div class="c"></div></div></div>${tagList(page, base)}${actions(page, base)}<div class="c"></div></div><div class="c"></div></div>${previewPager(page, base)}${previews(page, base)}${commentBlock(page, base)}`,
  );
}

/** The site's error box. The text of its paragraph is the only part clients have seen. */
export function errorBoxPageHtml(message: string, site: Site = "eh"): string {
  return pageShell(
    site,
    `<div class="d">\n<p>${escapeHtml(message)}</p>\n</div>`,
    "Gallery Not Available - E-Hentai Galleries",
  );
}

/** Partly unconfirmed: clients only check the "lose all rights to complain" paragraph. */
export function contentWarningPageHtml(
  gid = 9000001,
  token = "a1b2c3d4e5",
  site: Site = "eh",
): string {
  const gallery = `${siteBase(site)}g/${gid}/${token}/`;
  return pageShell(
    site,
    `<div style="width:720px; margin:20px auto"><h1>Content Warning</h1><p>This gallery has been flagged as <strong>Offensive For Everyone</strong>. Due to its content, it should not be viewed by anyone.</p><p>(And if you choose to ignore this warning, you lose all rights to complain about it in the future.)</p><p><a href="${gallery}?nw=session">View Gallery</a> &nbsp; <a href="${gallery}?nw=always">Never Warn Me Again</a> &nbsp; <a href="${siteBase(site)}">Get Me Outta Here</a></p></div>`,
  );
}

function scriptVariables(page: DetailPage, base: string): string {
  return `<script type="text/javascript">
var base_url = "${base}";
var api_url = "https://api.e-hentai.org/api.php";
var gid = ${page.gid};
var token = "${page.token}";
var apiuid = ${page.apiuid};
var apikey = "${page.apikey}";
var average_rating = ${page.ratingAverage ?? 0};
var display_rating = ${page.ratingAverage ?? 0};
var popbase = base_url+"gallerypopups.php?gid=${page.gid}&t=${page.token}&act=";
function pop_fav(){return popUp(popbase+"addfav",675,415);}
</script>
<script type="text/javascript" src="${base}z/0376/ehg_gallery.c.js"></script>`;
}

function metadataTable(page: DetailPage, base: string): string {
  const parent =
    page.parent === null
      ? "None"
      : `<a href="${base}g/${page.parent.gid}/${page.parent.token}/">${page.parent.gid}</a>`;
  const rows: [label: string, value: string, id?: string][] = [
    ["Posted", page.posted],
    ["Parent", parent],
    ["Visible", page.visible],
    ["Language", `${page.language} &nbsp;`],
    ["File Size", page.fileSize],
    ["Length", `${page.length} pages`],
    ["Favorited", page.favorited, "favcount"],
  ];
  const cells = rows
    .map(
      ([label, value, id]) =>
        `<tr><td class="gdt1">${label}:</td><td class="gdt2"${id === undefined ? "" : ` id="${id}"`}>${value}</td></tr>`,
    )
    .join("");
  return `<div id="gdd"><table>${cells}</table></div>`;
}

function ratingBlock(page: DetailPage, base: string): string {
  const label = page.ratingAverage === null ? "Not Yet Rated" : `Average: ${page.ratingAverage}`;
  return `<div id="gdr" onmouseout="rating_reset()"><table><tr><td id="grt1">Rating:</td><td id="grt2"><div id="rating_image" class="ir" style="background-position:0px -21px"><img src="${base}img/blank.gif" usemap="#rating" /></div></td><td id="grt3"><span id="rating_count">${page.ratingCount}</span></td></tr><tr><td id="rating_label" colspan="3">${label}</td></tr></table></div>`;
}

function tagList(page: DetailPage, base: string): string {
  const rows = page.tags
    .map((group) => {
      const tags = group.names
        .map((name) => {
          const id = `${group.namespace}:${name.replaceAll(" ", "_")}`;
          const query = `${group.namespace}:${name.replaceAll(" ", "+")}`;
          return `<div id="td_${id}" class="gt" style="opacity:1.0"><a id="ta_${id}" href="${base}tag/${query}" class="" onclick="return toggle_tagmenu(1,'${group.namespace}:${name}',this)">${escapeHtml(name)}</a></div>`;
        })
        .join("");
      return `<tr><td class="tc">${group.namespace}:</td><td>${tags}</td></tr>`;
    })
    .join("");
  return `<div id="gd4"><div id="taglist"><table>${rows}</table></div><div id="tagmenu_act" style="display:none"></div></div>`;
}

function actions(page: DetailPage, base: string): string {
  const popup = (path: string, size: string) => `return popUp('${base}${path}',${size})`;
  return `<div id="gd5"><p class="g3 gsp"><img src="https://ehgt.org/g/mr.gif" /> <a href="${base}g/${page.gid}/${page.token}/?report=select">Report Gallery</a></p><p class="g2 gsp"><img src="https://ehgt.org/g/mr.gif" /> <a href="#" onclick="${popup(`archiver.php?gid=${page.gid}&amp;token=${page.token}`, "480,320")}">Archive Download</a></p><p class="g2"><img src="https://ehgt.org/g/mr.gif" /> <a href="#" onclick="${popup(`gallerytorrents.php?gid=${page.gid}&amp;t=${page.token}`, "610,590")}">Torrent Download (${page.torrentCount})</a></p></div>`;
}

function previewPager(page: DetailPage, base: string): string {
  const last = page.previewStart + page.previewPageTokens.length - 1;
  return `<div class="gtb"><p class="gpc">Showing ${page.previewStart} - ${last} of ${page.length} images</p><table class="ptt" style="margin:2px auto 0px"><tr><td class="ptdd">&lt;</td><td class="ptds"><a href="${base}g/${page.gid}/${page.token}/" onclick="return false">1</a></td><td class="ptdd">&gt;</td></tr></table></div>`;
}

function previews(page: DetailPage, base: string): string {
  const items = page.previewPageTokens
    .map((pageToken, index) => {
      const number = page.previewStart + index;
      return `<a href="${base}s/${pageToken}/${page.gid}-${number}"><div title="Page ${number}: sample_${number}.jpg" style="width:200px;height:283px;background:transparent url(https://ehgt.org/t/0a/0a/${pageToken}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-111111-1280-1810-jpg_l.jpg) 0 0 no-repeat"></div></a>`;
    })
    .join("");
  return `<div id="gdt" class="gt200">${items}</div>`;
}

function commentBlock(page: DetailPage, base: string): string {
  const comments = page.comments.map((comment) => renderComment(comment, base)).join("");
  return `<div id="cdiv" class="gm">${comments}<div id="chd"><p id="postnewcomment">[<a href="#" onclick="display_comment_field(); return false">Post New Comment</a>]</p></div></div>`;
}

function renderComment(comment: DetailComment, base: string): string {
  const isUploader = comment.id === 0;
  const voting = isUploader
    ? `<div class="c4 nosel"><a name="ulcomment"></a>Uploader Comment</div>`
    : `<div class="c4 nosel">[<a id="comment_vote_up_${comment.id}" style="" href="#" onclick="vote_comment_up(${comment.id}); this.blur(); return false">Vote+</a>] &nbsp; [<a id="comment_vote_down_${comment.id}" style="" href="#" onclick="vote_comment_down(${comment.id}); this.blur(); return false">Vote-</a>]</div><div class="c5 nosel" onmouseover="document.getElementById('cvotes_${comment.id}').style.display=''">Score <span id="comment_score_${comment.id}" style="opacity:1.0">${comment.score}</span></div>`;
  const edited =
    comment.edited === null
      ? ""
      : `<div class="c8">Last edited on <strong>${comment.edited}</strong>.</div>`;
  return `<a name="c${comment.id}"></a><div class="c1"><div class="c2"><div class="c3">Posted on ${comment.posted} by: &nbsp; <a href="${base}uploader/${encodeURIComponent(comment.author)}">${escapeHtml(comment.author)}</a></div>${voting}<div class="c"></div></div><div class="c6" id="comment_${comment.id}">${comment.bodyHtml}</div>${edited}<div class="c7" id="cvotes_${comment.id}" style="display:none">Base +5</div></div>`;
}
