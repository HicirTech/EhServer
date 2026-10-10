# ADR-0004: State in SQLite

- Status: Accepted (maintainer, 2026-10-11), after the first tables were built on it.

## Context

Cooldowns, budgets, jobs and account state must survive restarts ([nfr.md](../nfr.md) REL-3), and the stack prefers built-ins ([ADR-0002](0002-bun-typescript-no-framework.md)).

## Decision

- One SQLite database (`bun:sqlite`, WAL mode) in the data directory holds:
  - users, tokens and accounts;
  - egress state, cooldowns and budgets;
  - jobs, steps and events;
  - idempotency keys;
  - toplist snapshots ([ADR-0010](0010-complete-toplists.md));
  - cache metadata and the sample index.
- Library files live on disk under the library root ([ADR-0007](0007-library-format.md)). The database holds only their index.
- Schema changes are numbered migrations. They run at start-up, each inside its own transaction together with SQLite's `user_version`, and have tests. A database at a newer version than the server knows is refused.

## Consequences

- Single node only, and no external database to operate.
- A backup is the data directory; the database file is copied with SQLite's online backup.
- Long-running work stays off the request path and runs as jobs.
