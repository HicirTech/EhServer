# ADR-0003: Rewritten E-Hentai parsers with positive identification

- Status: Accepted (maintainer, 2026-10-10)

## Context

Existing open-source clients turn many failures into empty results or default values ([wiki: Response-Classification](https://github.com/HicirTech/EhServer/wiki/Response-Classification)). The maintainer decided three things: the parsers are rewritten rather than reused; success must be identified positively; and a write succeeds only when a read-back confirms it.

## Decision

- All E-Hentai knowledge (URLs, request shapes, parsers, classification) lives in one module, `eh-core`, as pure functions without I/O.
- Every parse returns exactly one of:
  - `success`;
  - `empty`, an empty result that was positively identified;
  - `failure`, with a known failure code;
  - `unrecognized`.
- No default value stands in for missing data.
- Responses are classified in the fixed order of [outcomes.md](../outcomes.md) before any success parsing.
- Every write is followed by a read-back. Without confirmation the result is `write_unconfirmed`.
- Client code from other projects is reference material only.

## Consequences

- We follow site changes ourselves. An unrecognized response is a failure: it saves a sanitized sample and raises an alert, so a site change shows up at once instead of turning into empty lists.
- Each parser starts from success, empty and failure fixtures; the code comes after them.
- Each write costs one extra upstream request, which the governor budgets ([ADR-0005](0005-egress-governor.md)).
