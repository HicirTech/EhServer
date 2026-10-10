# ADR-0008: REST with an OpenAPI contract, SSE for events

- Status: Accepted (maintainer, 2026-10-10): REST, contract first, SSE. The details below are Proposed.

## Decision

- The base path is `/api/v1`. The contract is [`api/openapi.yaml`](../../api/openapi.yaml) (OpenAPI 3.1) and is written before the code.
- JSON field names are camelCase and follow the official `gdata` vocabulary where it exists.
- Errors use RFC 9457 `application/problem+json`. Each carries a stable `code` from [outcomes.md](../outcomes.md), a `requestId`, a `clientAction` and, when it applies, `retryAfter`.
- Events for jobs, egresses and accounts stream over SSE at `/events`, using the same outcome codes.
- Lists use opaque cursors. Upstream URLs and upstream query syntax never appear in the API.
- Changes within `v1` are additive only. Capabilities are discoverable at `/meta`.
- Every response carries `X-Request-Id` and `Server-Timing`.
- Writes take an `Idempotency-Key` header.

## Consequences

- Clients never need to reach an E-Hentai host; EhServer serves the images too.
- A validator that checks requests and responses against the contract is needed (choice open).
