# ADR-0006: Users, E-Hentai accounts and API tokens

- Status: Proposed

## Context

EhServer serves several users ([ADR-0001](0001-generic-scope.md)). E-Hentai allows one active account per person and treats account sharing as multi-accounting. Its forum log-in is behind a Cloudflare challenge, so a scripted password log-in does not work ([wiki: Login-and-Session](https://github.com/HicirTech/EhServer/wiki/Login-and-Session)).

## Decision

- A user is an API principal. A user has at most one E-Hentai account, and an account belongs to exactly one user.
- Sign-in is cookie import only. The user signs in with a browser and gives the server:
  - `ipb_member_id` and `ipb_pass_hash`;
  - `igneous`, for ExHentai;
  - `iq`, if present.

  There is no password flow.
- Credentials are encrypted at rest with a key kept outside the data directory, and are never logged ([nfr.md](../nfr.md) SEC-1).
- The server checks session health and never lets a known-invalid value (`igneous=mystery` and similar) overwrite a valid one.
- API access uses bearer tokens, one per device or app. A token is random (256 bits), stored as a SHA-256 hash, scoped (`read`, `write`, `jobs`, `admin`) and revocable.

## Consequences

- Every account-scoped answer (favourites, own rating, quota) is cached per account and never shared ([domain-model.md](../domain-model.md) I1).
- A token's secret is shown once, at creation.
