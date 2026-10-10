# ADR-0001: Generic scope, no client-specific data

- Status: Accepted (maintainer, 2026-10-10)

## Context

EhServer started from a mobile client's plan to move all E-Hentai traffic onto a home server. The maintainer decided that EhServer is a generic API project: like any API, it is not shaped around one person's environment or one client.

## Decision

- EhServer exposes a generic HTTP API over the E-Hentai domain. It holds no client-specific formats, names, endpoints or storage layouts.
- It serves several users, each with their own E-Hentai account ([ADR-0006](0006-users-accounts-tokens.md)).
- Clients integrate through their own adapters. An adapter is only an API client: adding or changing one never needs a server change or restart.
- The server keeps its own library format ([ADR-0007](0007-library-format.md)). Mapping it onto a client's layout is that client's adapter's job.

## Consequences

- The API needs capability discovery (`/meta`) and additive-only versioning ([ADR-0008](0008-api-style.md)).
- A feature request from one client becomes a generic resource, or stays in that client's adapter.
- The server is the only writer of its library, so no client can race it on the same files.
