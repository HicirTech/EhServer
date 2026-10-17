/**
 * The database schema as numbered steps (ADR-0004). A released step never changes; a change is a
 * new step appended at the end.
 */
export const Migrations: readonly string[] = [
  `CREATE TABLE toplist_snapshots (
    type TEXT NOT NULL,
    period TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    PRIMARY KEY (type, period)
  ) STRICT;
  CREATE TABLE toplist_entries (
    type TEXT NOT NULL,
    period TEXT NOT NULL,
    rank INTEGER NOT NULL,
    score INTEGER NOT NULL,
    gid INTEGER NOT NULL,
    token TEXT NOT NULL,
    PRIMARY KEY (type, period, rank),
    FOREIGN KEY (type, period) REFERENCES toplist_snapshots (type, period) ON DELETE CASCADE
  ) STRICT;`,
  `CREATE TABLE egress_states (
    egress_id TEXT NOT NULL PRIMARY KEY,
    cooldown_until TEXT NOT NULL,
    reason TEXT NOT NULL,
    slowed_until TEXT
  ) STRICT;`,
  `CREATE TABLE users (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE api_tokens (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    scopes TEXT NOT NULL,
    secret_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    last_used_at TEXT,
    revoked_at TEXT
  ) STRICT;`,
];
