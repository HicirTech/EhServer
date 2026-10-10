# E-Hentai mock

A stand-in for E-Hentai that tests, and later the `mock` egress profile ([ADR-0005](../docs/adr/0005-egress-governor.md)), talk to instead of the site. It serves synthetic galleries built from [`fixtures/eh`](../fixtures/), and it can put any known upstream failure in place of a normal answer ([outcomes.md](../docs/outcomes.md) rule R7, [nfr.md](../docs/nfr.md) TEST-1).

## Addresses

The upstream URL `https://<host>/<path>` is served at `<mock url>/<host>/<path>`. Hosts so far: `e-hentai.org` and `exhentai.org`.

| Path | Serves |
|---|---|
| `/` with `f_search`, `next`, `prev` | a compact-mode search page, 25 galleries, newest first; `f_search` is one phrase, matched in titles and tags |
| `/g/<gid>/<token>/` with `p` | a gallery page and its `p`-th page of 20 previews |

The catalogue holds galleries 9000001 to 9000060 (`catalog.ts`). A gallery URL with an unknown gid or a wrong token gets the site's "Key missing" error box.

## Faults

A rule replaces the answer to matching requests, `times` times. In tests call `mock.addFault({ fault, host?, pathPrefix?, times })`; from another process use the control API below.

| Fault | What the site does | Outcome it should produce | Known from |
|---|---|---|---|
| `connection_reset` | breaks off the transfer | `network` | — |
| `no_answer` | does not answer until the client gives up | `network` | — |
| `http_429` | HTTP 429 with `Retry-After` | `upstream_rate_limited` | other clients |
| `cloudflare_403` | HTTP 403 with a challenge page | `cloudflare_challenge` | seen on the forums; page shape assumed |
| `backend_fetch_failed` | HTTP 503 "Backend fetch failed" | `upstream_unavailable` | other clients |
| `empty_body` | HTTP 200 with no body | `sad_panda` on ExHentai; a suspected ban on E-Hentai | other clients |
| `ban_text` | the plain-text ban notice | `ip_banned` | a community capture |
| `too_fast_text` | the "You are opening…" warning | `too_fast_warning` | the prefix only |
| `sad_panda` | the Sad Panda image headers | `sad_panda` | client code |
| `kokomade` | the kokomade image | `sad_panda` | client code |
| `content_warning` | the content warning page | `content_warning` | one paragraph, from client code |
| `gallery_removed` | error box: "pining for the fjords" | `gallery_removed` | client code |
| `gallery_unavailable` | error box: "This gallery is unavailable…" | `gallery_unavailable` | client code |
| `key_missing` | error box: "Key missing, or incorrect key provided." | `invalid_token` | client code |
| `error_box` | error box with any other message | `site_error` | client code |

Not covered yet: the 509 image, quota and GP texts, the log-on page, the "no H@H client" text, API (`api.php`) errors, images and their integrity.

## Control API

| Request | Effect |
|---|---|
| `POST /__mock/faults` with `{ "fault", "host"?, "pathPrefix"?, "times" }` | adds a rule |
| `DELETE /__mock/faults` | removes all rules |
| `GET /__mock/requests` | the upstream requests served so far |
| `DELETE /__mock/requests` | clears that log |

## Run

```bash
bun mock/main.ts --port 7878
```
