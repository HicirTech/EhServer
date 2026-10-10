# ADR-0008: REST with an OpenAPI contract, SSE for events

- Status: Accepted (maintainer, 2026-10-10): REST, contract first, SSE. The contract checker is our own (maintainer, 2026-10-11). The other details below are Proposed.

## Decision

- The base path is `/api/v1`. The contract is [`api/openapi.yaml`](../../api/openapi.yaml) (OpenAPI 3.1) and is written before the code.
- JSON field names are camelCase and follow the official `gdata` vocabulary where it exists.
- Errors use RFC 9457 `application/problem+json`. Each carries a stable `code` from [outcomes.md](../outcomes.md), a `requestId`, a `clientAction` and, when it applies, `retryAfter`.
- Events for jobs, egresses and accounts stream over SSE at `/events`, using the same outcome codes.
- Lists use opaque cursors. Upstream URLs and upstream query syntax never appear in the API.
- Changes within `v1` are additive only. Capabilities are discoverable at `/meta`.
- Every response carries `X-Request-Id` and `Server-Timing`.
- Writes take an `Idempotency-Key` header.
- Tests check responses against the contract with our own checker (`src/contract/`). It knows exactly the JSON Schema the contract uses, and fails on any other keyword instead of skipping it. Objects are closed: a property the contract does not declare is a finding, so no undeclared field reaches a client.

## Consequences

- Clients never need to reach an E-Hentai host; EhServer serves the images too.
- When the contract starts using another JSON Schema keyword, the checker fails until it learns it.
