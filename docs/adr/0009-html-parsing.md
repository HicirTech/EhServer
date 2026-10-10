# ADR-0009: How HTML is parsed

- Status: Open

## Context

`eh-core` parses HTML pages: lists, gallery details, single pages, the home page, favourites and the archiver. Positive identification ([ADR-0003](0003-eh-core-positive-identification.md)) checks a page's structure, not only the values in it.

## Options

| Option | For | Against |
|---|---|---|
| Bun's built-in `HTMLRewriter` | no dependency; streaming; CSS selectors | handler-based with no tree: relations between elements need hand-written state |
| A DOM library | tree queries make structural checks direct | a third-party dependency to pin and review |

## Next step

Port two fixtures, a list page and a gallery detail page, with each option. Compare code size, how clearly the success signature reads, and test effort. Decide before `eh-core` work starts.
