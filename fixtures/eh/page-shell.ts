export type Site = "eh" | "ex";

const SiteBases: Readonly<Record<Site, string>> = {
  eh: "https://e-hentai.org/",
  ex: "https://exhentai.org/",
};

const SiteTitles: Readonly<Record<Site, string>> = {
  eh: "E-Hentai Galleries",
  ex: "ExHentai.org",
};

export function siteBase(site: Site): string {
  return SiteBases[site];
}

/** PHP `htmlspecialchars` with `ENT_QUOTES`, which is how the site escapes text and attributes. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function pageShell(site: Site, body: string, title = SiteTitles[site]): string {
  const base = siteBase(site);
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" type="text/css" href="${base}z/0376/x.css" />
</head>
<body>
<script type="text/javascript">
function popUp(URL,w,h) { window.open(URL,"_pu"+(Math.random()+"").replace(/0\\./,""),"width="+w+",height="+h); return false; }
</script>
<div id="nb" class="nosel"><div><a class="nbw" href="${base}">Front<span class="nbw1"> Page</span></a></div><div><a href="${base}watched">Watched</a></div><div><a href="${base}popular">Popular</a></div><div><a href="${base}torrents.php">Torrents</a></div><div><a href="${base}favorites.php">Fav<span class="nbw1">orite</span>s</a></div><div><a href="${base}uconfig.php">Settings</a></div><div><a href="${base}mytags">My Tags</a></div></div>
${body}
<div class="dp" style="margin:0 auto 5px"><a href="${base}">Front Page</a></div>
</body>
</html>
`;
}
