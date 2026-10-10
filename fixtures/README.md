# Synthetic E-Hentai pages

Tests and the mock use pages and API answers built by the functions in `eh/`. Every value in them is made up: gallery ids from 9000001, placeholder titles, tags, names and keys. No captured page is in the repository, and none may enter it: captured pages hold account values (`apikey`, tracker and forum keys) and real gallery content ([nfr.md](../docs/nfr.md) SEC-4).

A builder is a claim about the shape of a real page. Each one names the capture it mirrors:

| Builder | Mirrors |
|---|---|
| `listPageHtml` | a compact-mode search page captured in 2023-01, with its pager; the other display modes and the advertisement row follow pages captured in 2019 and 2021 |
| `filteredOutPageHtml` | the "no unfiltered results" row of an undated compact page from before cursor paging |
| `noHitsPageHtml` | **unconfirmed**: only the text `No hits found</p>` is known |
| `noWatchedTagsPageHtml` | **unconfirmed**: only a paragraph starting "You do not have any watched tags" is known |
| `gdataJson` | the `gdata` answer as the official documentation shows it; the types of the lineage fields are unconfirmed |
| `singlePageHtml` | a single page captured in 2019, with the original link in `#i6` as the site has put it since 2023-10 (or in `#i7`, as before) |
| `showpageJson` | a `showpage` answer captured in 2019, with the same choice of `i6` or `i7` |
| `gtokenJson` | the `gtoken` answer as the official documentation shows it |
| `homePageHtml` | the "Image Limits" box captured in 2023-10, 2024-08 and 2025-06; the IP wording without the restriction sentence is **unconfirmed** |
| `detailPageHtml` | a gallery page captured in 2024-10 |
| `errorBoxPageHtml` | the `<div class="d">` error box; only its paragraph is known |
| `contentWarningPageHtml` | **partly unconfirmed**: only the "lose all rights to complain" paragraph is known |
| `favoritesPageHtml` | a favourites folder captured in 2024-09 in Extended mode, ordered by favourited time; the "Show All" view and the Minimal and Compact rows follow pages captured in 2023-07 in every display mode. **Unconfirmed**: an empty folder (the builder leaves the list out), a filled note (`Note: …`), the row colours of folders 3 to 9 (the palette clients use), and the posted time's border colour, which the builder leaves out |
| `watchedTagsPageHtml` | a My Tags page captured on ExHentai in 2022-01, with one tag set whose tags are all watched; hidden tags, a set colour and an empty tag set are **unconfirmed** |
| `logOnPageHtml` | **unconfirmed**: only the paragraph `This page requires you to log on.` is known |

Where a builder and a newer real page disagree, the real page wins, and the builder changes in the same piece of work.
