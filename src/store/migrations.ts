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
];
