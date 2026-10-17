# ADR-0006: Users, E-Hentai accounts and API tokens

- Status: Accepted (maintainer, 2026-10-17 and 2026-10-18). The points under "Mechanics" are the implementer's and Proposed.

## Context

EhServer serves several users ([ADR-0001](0001-generic-scope.md)). E-Hentai allows one active account per person and treats account sharing as multi-accounting. Its forum log-in is behind a Cloudflare challenge, so a scripted password log-in does not work ([wiki: Login-and-Session](https://github.com/HicirTech/EhServer/wiki/Login-and-Session)). Settings and secrets reach the server through one configuration file and the environment variables it names ([ADR-0012](0012-configuration-file.md)).

## Decision

- A user is an API principal. A user has at most one E-Hentai account, and an account belongs to exactly one user.
- Sign-in is cookie import only. A user imports their own account's cookies with their own token, and an administrator can also add an account for any user; an administrator lists and removes accounts. Nobody can read stored cookies back. Whoever imports signs in with a browser and gives the server:
  - `ipb_member_id` and `ipb_pass_hash`;
  - `igneous`, for ExHentai;
  - `iq`, if present.

  There is no password flow.
- Credentials are encrypted at rest with a key read from the environment variable the configuration names, so the key stays outside the data directory, and they are never logged ([nfr.md](../nfr.md) SEC-1).
- The key can be replaced when needed. Each encrypted record names the key it was encrypted with. After a change the server keeps running, and credentials stored under another key are reported as needing a new import instead of being decrypted or used. Nothing is re-encrypted in place: a new key means each user imports their cookies once more.
- The server checks session health and never lets a known-invalid value (`igneous=mystery` and similar) overwrite a valid one.
- API access uses bearer tokens, one per device or app. A token is random (256 bits), stored as a SHA-256 hash, scoped (`read`, `write`, `jobs`, `admin`) and revocable. A token has no expiry unless one is set when it is made; a revoked or expired token stops working at once.
- The first administrator token is made on the server's own machine with `bun src/main.ts --config <file> create-admin-token <user name>`, which prints its secret once. Further users and tokens are made through the admin API.

## Mechanics

- A token's secret is `ehs_` followed by 43 base64url characters, so secret scanners can recognise one.
- `admin` grants every other scope.
- A token's last use is recorded at most once a minute.
- User names are unique and use lower-case letters, digits, `-` and `_`.
- A request is routed before its token is checked, so an unknown path or method is answered without a token. The contract is public, so this tells a caller nothing new.

## Consequences

- Every endpoint except `/meta` and `/health` needs a token; `getToplist` needs `read`.
- Every account-scoped answer (favourites, own rating, quota) is cached per account and never shared ([domain-model.md](../domain-model.md) I1).
- A token's secret is shown once, at creation.
- Losing or replacing the key costs every user one cookie import, and nothing else.
