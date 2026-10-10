# ADR-0002: Bun and TypeScript, no framework

- Status: Accepted (maintainer, 2026-10-10)

## Context

The maintainer's usual stack is Bun with TypeScript, and the project does not need a heavy framework. The reliability bar ([nfr.md](../nfr.md)) favours few moving parts and few third-party dependencies.

## Decision

- Runtime: Bun. Language: TypeScript in strict mode; compiler and linter warnings fail the build.
- HTTP: `Bun.serve` with a small in-house router.
- Built-ins first: `fetch` (with its proxy option) for upstream traffic, `bun:sqlite` for state ([ADR-0004](0004-state-in-sqlite.md)), `Bun.YAML` for reading the contract, `crypto` for hashing and encryption.
- Every third-party dependency needs a recorded reason, a pinned version and an entry in the dependency list.

## Consequences

- Routing, validation and error mapping are our own code. It stays small and is fully covered by tests.
- Responses are checked against the OpenAPI contract by our own checker, not a library ([ADR-0008](0008-api-style.md)).
- The mock of E-Hentai uses the same stack ([outcomes.md](../outcomes.md), rule R7).
