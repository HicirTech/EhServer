# Synthetic E-Hentai pages

Tests and the mock use pages built by the functions in `eh/`. Every value in them is made up: gallery ids from 9000001, placeholder titles, tags, names and keys. No captured page is in the repository, and none may enter it: captured pages hold account values (`apikey`, tracker and forum keys) and real gallery content ([nfr.md](../docs/nfr.md) SEC-4).

A builder is a claim about the shape of a real page. Each one names the capture it mirrors:

| Builder | Mirrors |
|---|---|
| `listPageHtml` | a compact-mode (`dm_l`) search page captured in 2023-01 |
| `filteredOutPageHtml` | the "no unfiltered results" row of an undated compact page from before cursor paging |
| `noHitsPageHtml` | **unconfirmed**: only the text `No hits found</p>` is known |
| `detailPageHtml` | a gallery page captured in 2024-10 |
| `errorBoxPageHtml` | the `<div class="d">` error box; only its paragraph is known |
| `contentWarningPageHtml` | **partly unconfirmed**: only the "lose all rights to complain" paragraph is known |

Where a builder and a newer real page disagree, the real page wins, and the builder changes in the same piece of work.
