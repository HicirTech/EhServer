# EhServer design

EhServer is a generic, self-hosted HTTP API over the E-Hentai domain. These documents are the design of record. The facts they rest on are in the [research wiki](https://github.com/HicirTech/EhServer/wiki), whose [EhServer-Implications](https://github.com/HicirTech/EhServer/wiki/EhServer-Implications) page explains how the decisions fit together.

| Document | Status | Content |
|---|---|---|
| [Architecture decisions](adr/) | see each ADR | ADR-0001 to ADR-0011 |
| [Domain model](domain-model.md) | Proposed | Entities, identities, value sets, lifecycles, invariants |
| [Outcome catalog](outcomes.md) | Proposed | How every upstream response is classified, and what happens next |
| [Non-functional requirements](nfr.md) | Proposed | Quality bar, requirements, hazards and controls |
| [API contract](../api/openapi.yaml) | Draft | `/api/v1` in OpenAPI 3.1 |
| [Dependencies](dependencies.md) | Draft | Third-party packages, pinned versions and reasons |

Statuses: **Accepted** means decided by the maintainer; **Proposed** means written for review; **Open** means not decided; **Draft** means incomplete.

EhServer is released under the [MIT License](../LICENSE).

## Architecture decisions

| ADR | Decision | Status |
|---|---|---|
| [0001](adr/0001-generic-scope.md) | Generic scope, no client-specific data | Accepted |
| [0002](adr/0002-bun-typescript-no-framework.md) | Bun and TypeScript, no framework | Accepted |
| [0003](adr/0003-eh-core-positive-identification.md) | Rewritten E-Hentai parsers with positive identification | Accepted |
| [0004](adr/0004-state-in-sqlite.md) | State in SQLite | Accepted |
| [0005](adr/0005-egress-governor.md) | One governor for all upstream traffic | Accepted in part |
| [0006](adr/0006-users-accounts-tokens.md) | Users, E-Hentai accounts and API tokens | Proposed |
| [0007](adr/0007-library-format.md) | The library format | Proposed |
| [0008](adr/0008-api-style.md) | REST with an OpenAPI contract, SSE for events | Accepted in principle |
| [0009](adr/0009-html-parsing.md) | How HTML is parsed: htmlparser2 with css-select | Accepted |
| [0010](adr/0010-complete-toplists.md) | Toplists are served whole, from snapshots | Accepted in part |
| [0011](adr/0011-proxy-egress.md) | Requests to the site leave only through a proxy | Accepted in part |
