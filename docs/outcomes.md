# Outcome catalog

- Status: Proposed
- Facts: [wiki: Response-Classification](https://github.com/HicirTech/EhServer/wiki/Response-Classification)

Every upstream response is classified into exactly one outcome. The outcome decides what the server does next and what a client sees.

## 1. Rules

| ID | Rule |
|---|---|
| R1 | Success must be identified positively. Anything not identified is `upstream_unrecognized`, a failure. (Maintainer: hard rule.) |
| R2 | Classification follows the fixed order of section 2. |
| R3 | Every outcome has exactly one server action and one client action. |
| R4 | A write succeeds only when a read-back confirms it; otherwise the outcome is `write_unconfirmed`. (Maintainer.) |
| R5 | A degraded success is its own outcome, never plain success. |
| R6 | Unrecognized responses, and rare failures, are kept as sanitized samples and raise an alert. |
| R7 | The server, the mock and the fixtures share this catalog. Every code has a fault-injection scenario in the mock and a test that checks its action. |

## 2. Classification order

1. Cancelled by the client.
2. Transport error.
3. HTTP status: 429; 403 with a Cloudflare challenge; 5xx.
4. Empty body.
5. Cross-cutting texts: ban, warning, quota and GP texts, `Backend fetch failed`.
6. Failures specific to the operation.
7. The operation's success signature, including positively identified empty results.
8. Otherwise `upstream_unrecognized`.

Local checks run before any request is sent: a cooldown in force (`egress_cooldown`), an unreachable egress (`egress_unavailable`), a spend over budget (`gp_budget_exceeded`).

## 3. Kinds and client actions

Kinds: `success`, `empty`, `degraded`, `failure`, `unrecognized`, `unconfirmed`.

| Client action | Meaning for the API client |
|---|---|
| `none` | Use the result. |
| `retry_after` | Retry the same request after `retryAfter` seconds. |
| `retry_same_key` | The outcome of a write is unknown. Retry with the same `Idempotency-Key`; the server reads the current state before writing again. |
| `user_action` | A person must act: sign in again, grant ExHentai access, add GP, raise a budget. |
| `give_up` | Permanent for this resource. |

## 4. Codes

Scope is what the server action applies to: the request, the job, the account or the egress.

| Code | Kind | Detected by | Scope | Server action | API status | Client action |
|---|---|---|---|---|---|---|
| `ok` | success | the operation's success signature | request | continue | 200 | `none` |
| `ok_empty` | empty | no hits; filtered to empty; no watched tags | request | return an empty result | 200 | `none` |
| `ok_degraded` | degraded | image served below the requested variant | job | keep it marked degraded; pause the job if it requires originals | 200 with `degraded: true` | `none` |
| `cancelled` | failure | client disconnect or cancel | request | stop; no retry | none sent | — |
| `network` | failure | transport error or timeout | request | retry twice with backoff (after 2 s, then 8 s), then fail the step | 502 | `retry_after` |
| `upstream_rate_limited` | failure | HTTP 429 | egress | cooldown for `Retry-After`, 60 s if absent | 503 | `retry_after` |
| `cloudflare_challenge` | failure | HTTP 403 with a challenge page | egress | cooldown 30 min; alert | 503 | `retry_after` |
| `upstream_unavailable` | failure | HTTP 5xx, or `Backend fetch failed` | egress | retry after 60 s, at most 3 times; then fail | 503 | `retry_after` |
| `too_fast_warning` | failure | the "opening pages too fast" warning | egress | cooldown of at least 15 min; halve the page rate for 24 h; alert | 503 | `retry_after` |
| `ip_banned` | failure | the ban text, with its expiry parsed | egress | cooldown until the expiry plus 10 %, an hour when no expiry is given; alert | 503 | `retry_after` |
| `ip_degraded` | failure | the home page says the IP is restricted to low resolution | egress | stop original-image work; alert | 503 for originals | `retry_after` |
| `quota_exhausted` | failure | a 509 image or a limit text | account, or egress in IP mode | pause image work for 60 min, then recheck the home page | 503 | `retry_after` |
| `insufficient_gp` | failure | GP texts, or `Insufficient funds.` | account | pause GP-spending work | 409 | `user_action` |
| `gp_budget_exceeded` | failure | the spend would exceed the job's GP budget (local check) | job | pause the job | 409 | `user_action` |
| `signed_out` | failure | log-on page; session cookies missing; `apiuid` below 0 | account | mark the session expired; pause the account's work | 409 | `user_action` |
| `sad_panda` | failure | Sad Panda headers; empty body on ExHentai; kokomade | account | mark ExHentai access `no` | 409 | `user_action` |
| `no_hath_client` | failure | the "must have a H@H client" text | request | fail | 409 | `user_action` |
| `gallery_removed` | failure | "pining for the fjords" | request | fail; mark the gallery removed | 404 | `give_up` |
| `gallery_unavailable` | failure | "gallery is unavailable", or `Gallery Not Available - ` | request | fail | 404 | `give_up` |
| `invalid_token` | failure | a `gdata` item error; `gtoken` "File not found"; key errors | request | refresh the token once, then fail | 404 | `give_up` |
| `content_warning` | failure | the content-warning page | request | retry once with the warning cookie, then treat as `upstream_unrecognized` | 502 | `retry_after` |
| `site_error` | failure | the site's generic error box; its message is kept | request | fail | 502 | `give_up` |
| `integrity_mismatch` | failure | size or sha1 differs from the expected value | job | delete the temporary file; retry once; then fail the page | 502 | `retry_after` |
| `egress_unavailable` | failure | the egress cannot be reached (local check) | egress | fail closed; never fall back | 503 | `retry_after` |
| `egress_cooldown` | failure | a cooldown is in force (local check) | request | do not send | 503 | `retry_after` |
| `upstream_unrecognized` | unrecognized | nothing matched | request and job | fail; keep a sample; alert; pause the job | 502 | `retry_after` |
| `write_unconfirmed` | unconfirmed | the read-back did not confirm the write | request | do not resend | 502 | `retry_same_key` |

EhServer's own conditions use ordinary statuses: 400 for an invalid request, 401 for a missing or bad token, 403 for a missing scope, 404 for an unknown resource, 429 when a client exceeds EhServer's own limits, and 501 for a toplist type that is not served yet ([ADR-0010](adr/0010-complete-toplists.md)).

## 5. Problem response

```json
{
  "type": "https://github.com/HicirTech/EhServer/blob/main/docs/outcomes.md#4-codes",
  "title": "IP banned",
  "status": 503,
  "code": "ip_banned",
  "clientAction": "retry_after",
  "retryAfter": 3540,
  "requestId": "req_01j9…",
  "detail": "The egress is banned by the site until 2026-10-10T12:00:00Z."
}
```

## 6. Samples

A sample is one upstream exchange: status, selected headers and body. Before it is stored, the redactor removes cookies, `apikey`, tokens, personal keys and account names. Samples are stored with the request id and the outcome, listed in the admin API, and become fixtures after review.

## 7. Open points

- The cooldowns and retry counts above are initial values and need evidence.
- No reliable signal for a degraded image is known yet (wiki: Response-Classification §5).
- `content_warning` on ExHentai needs a sample.
