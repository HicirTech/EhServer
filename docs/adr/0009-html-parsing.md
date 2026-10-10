# ADR-0009: How HTML is parsed

- Status: Proposed (2026-10-10), after the spike below. The maintainer decides.

## Context

`eh-core` parses HTML pages: lists, gallery details, single pages, the home page, favourites and the archiver. Positive identification ([ADR-0003](0003-eh-core-positive-identification.md)) checks a page's structure, not only the values in it.

The two options were Bun's built-in `HTMLRewriter` and a DOM library. The spike in [`spikes/0009-html-parsing`](../../spikes/0009-html-parsing/) ported a compact-mode search page and a gallery page with both. Each collector only takes strings out of the page; the same decoders and assemblers turn them into readings, so the comparison isolates HTML access.

Evidence:

- 46 tests on synthetic pages ([`fixtures/eh`](../../fixtures/eh/)), passed by both implementations;
- 32 captured pages, kept outside the repository and run locally with `compare-real-pages.ts`: both implementations return the same result on every page.

## Comparison

| Aspect | `HTMLRewriter` (Bun 1.4.2) | htmlparser2 12.0.0 with css-select 7.0.0 |
|---|---|---|
| Omitted end tags, which HTML allows | `</tr>`: handled. `</td>`, `</p>`, `</li>`: the next element is treated as nested, so its text is added to the one before, silently (`<td>x<td>y` reads `xy`) | all four handled as browsers do |
| Entities | text and attribute values come back escaped; decoding needs the `entities` package | decoded |
| Several matches | every match calls the handler, so "first match" has to be coded (`??=`). One captured gallery page has a second, text-less link in the uploader cell, which overwrote the uploader before this was coded | `selectOne` returns the first match |
| How the success signature reads | handlers run in document order and write into "the current row", which the parent element's handler created | one "find X in Y" per field |
| Code that collects the two pages (non-blank lines) | 248: list 84, gallery 133, helpers 31 | 107: list 36, gallery 46, helpers 25 |
| Parse time, median of 30, captured pages of 69–159 KB | 0.6–0.9 ms | 1.4–3.5 ms |
| Parse time, 480 KB page | 1.0 ms | 13 ms |
| Third-party packages | 1 (`entities`) | 10, from one maintainer family: htmlparser2, domhandler, domutils, domelementtype, dom-serializer, entities, css-select, css-what, nth-check, boolbase |
| Input | can parse while the body arrives | needs the whole body |

Both are far inside the parse budget: [nfr.md](../nfr.md) PERF-1 allows 50 ms for the whole request, and page requests are seconds apart ([ADR-0005](0005-egress-governor.md)).

Also tried:

- node-html-parser 9.0.4 drops a table whose `</tr>` is omitted: `<table class="itg"><tr><td>x</td></table>` parses as `<td>x</td>`. It lost the gallery table of both captured extended-mode list pages. Rejected.
- parse5 8.0.1 handles every omitted end tag above and builds the same tree as browsers, `tbody` included. It has no selector engine. Checked on the reproductions and four captured pages only.

## Decision (proposed)

- Parse with htmlparser2 and query with css-select, through two small wrappers (`find`, `findAll`).
- Selectors use descendant combinators and never name `tbody`: browsers insert it, htmlparser2 does not.
- The parser choice does not replace positive identification. Every field still goes through a decoder that rejects what it does not recognize.

Recommendation: htmlparser2 with css-select, because it returns the right text where `HTMLRewriter` silently does not, with less than half the code. Choose `HTMLRewriter` only if the dependency count must be minimal and every parsed page is known to close its cells, paragraphs and list items.

## Consequences

- Ten packages are pinned and listed in [dependencies.md](../dependencies.md), and they are updated together.
- parse5 stays the fallback if a page ever needs the browser's exact tree.
- The spike is deleted when `eh-core` has its first parsers (N6).
