# ADR-0005: One governor for all upstream traffic

- Status: Accepted in part (maintainer, 2026-10-10): one account per egress by default. The rest is Proposed.

## Context

[Wiki: Limits-and-Anti-Crawling](https://github.com/HicirTech/EhServer/wiki/Limits-and-Anti-Crawling) records the site's rules:

- the site limits and bans by IP;
- the image quota is per IP unless the account has a Bronze Star or the More Pages perk;
- each person may hold one active account;
- the official API guidance is 4–5 sequential requests, then a pause of about 5 s.

Existing clients pace almost nothing.

## Decision

- Every upstream request goes through the governor. Nothing else may open a connection to an E-Hentai host.
- Egress profiles are `mock`, `probe`, `direct` and `proxy:<name>`.
- Each account is bound to exactly one egress. When an egress is unavailable, its requests fail; nothing falls back to another egress.
- Budgets are kept per egress and per account, by request class: `api`, `page` (any HTML page load), `image` (image bytes), `file-search`, `archive`.
- Built-in maximums cannot be raised by configuration or by clients. Configuration may only lower them.
- Outcome actions drive state. Warning, ban, rate-limit, quota and Cloudflare outcomes put the egress or account into a cooldown. Cooldowns are stored in the database ([ADR-0004](0004-state-in-sqlite.md)) and survive restarts.
- By default an egress serves one account. Serving more needs an explicit setting, and `/egress` reports the risk for as long as the setting is on.

Initial limits, to be revised with evidence:

| Class | Limit per egress |
|---|---|
| `api` | at most 4 requests per 5 s |
| `page` | one at a time; starts at least 3 s apart, randomised between 3 and 6 s |
| `image` | 2 concurrent transfers |
| `file-search` | at least 10 s apart |
| `archive` | 2 concurrent streams |
| `nl` reloads | at most 1 per page, counted against a per-account budget |

## Consequences

- Throughput is bounded by design. Performance work therefore means issuing fewer upstream requests ([nfr.md](../nfr.md) PERF).
- Concurrent requests for the same upstream resource are merged into one.
- A bad outcome affects every user behind that egress at once. That is intended: they share the IP.
