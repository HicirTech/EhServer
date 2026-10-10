# Spike: how HTML is parsed (ADR-0009)

Two implementations of the same two parsers, a compact-mode search page and a gallery page:

| Folder | Parses with |
|---|---|
| `dom/` | htmlparser2 and css-select |
| `rewriter/` | Bun's `HTMLRewriter`, decoding entities with `entities` |

Both only collect strings (`raw.ts`). The shared `assemble-list.ts` and `assemble-detail.ts` turn them into readings through the decoders in `decoders.ts`, so the two folders differ only in how they reach the HTML. Results and the decision are in [ADR-0009](../../docs/adr/0009-html-parsing.md).

## Run

```bash
bun test spikes/0009-html-parsing
```

```bash
bun spikes/0009-html-parsing/compare-real-pages.ts <folder of captured pages> --runs 30
```

The second command runs both implementations over captured pages and prints, per page, what each recognized, whether they agree and how long they took. It prints no page content. Captured pages never enter the repository ([fixtures/README.md](../../fixtures/README.md)).

## Not settled here

These are for `eh-core` (N6):

- Display modes other than compact are not ported. Rows are found with `table.itg tr`, which would also match the nested tag tables of extended mode; `eh-core` needs child selectors there.
- Compact lists captured in 2019–2021 show tags without a namespace as `title=":name"`. The spike reports them as unrecognized. Whether current pages still do needs a current page.
- The page for a search with no hits is unconfirmed (fixtures/README.md).

The spike is deleted when `eh-core` has its first parsers.
