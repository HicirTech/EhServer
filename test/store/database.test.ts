/** The database and its migrations (ADR-0004; nfr.md REL-3, OPS-1). */
import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openDatabase, schemaVersion } from "../../src/store/database";
import { egressStateStore } from "../../src/store/egress-states";
import { Migrations } from "../../src/store/migrations";
import { type ToplistSnapshot, toplistSnapshotStore } from "../../src/store/toplist-snapshots";

const folders: string[] = [];

function databasePath(): string {
  const folder = mkdtempSync(join(tmpdir(), "ehserver-db-"));
  folders.push(folder);
  return join(folder, "ehserver.db");
}

afterEach(() => {
  for (const folder of folders.splice(0)) {
    rmSync(folder, { recursive: true, force: true });
  }
});

function tables(path: string): string[] {
  const db = new Database(path, { readonly: true });
  try {
    return db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name)
      .sort();
  } finally {
    db.close();
  }
}

describe("openDatabase", () => {
  test("REL-3: a new database is migrated to the latest step, in WAL mode with foreign keys", () => {
    const db = openDatabase(databasePath());

    expect(schemaVersion(db)).toBe(Migrations.length);
    expect(db.query("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
    expect(db.query("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
    db.close();
  });

  test("REL-3: opening it again runs no step twice", () => {
    const path = databasePath();
    openDatabase(path, ["CREATE TABLE first (x INTEGER) STRICT;"]).close();

    const db = openDatabase(path, [
      "CREATE TABLE first (x INTEGER) STRICT;",
      "CREATE TABLE second (y TEXT) STRICT;",
    ]);

    expect(schemaVersion(db)).toBe(2);
    db.close();
    expect(tables(path)).toEqual(["first", "second"]);
  });

  test("REL-3: a failing step leaves the database at the step before it", () => {
    const path = databasePath();

    expect(() =>
      openDatabase(path, [
        "CREATE TABLE first (x INTEGER) STRICT;",
        "CREATE TABLE second (y TEXT) STRICT; NOT SQL;",
      ]),
    ).toThrow();

    const db = openDatabase(path, ["CREATE TABLE first (x INTEGER) STRICT;"]);
    expect(schemaVersion(db)).toBe(1);
    db.close();
    expect(tables(path)).toEqual(["first"]);
  });

  test("REL-3: a database from the first step keeps its snapshots when the later steps run", () => {
    const path = databasePath();
    const snapshot: ToplistSnapshot = {
      period: "yesterday",
      observedAt: new Date("2026-10-11T08:00:00.000Z"),
      entries: [{ rank: 1, score: 12_000, gallery: { gid: 9000001, token: "a1b2c3d4e5" } }],
    };
    const first = openDatabase(path, Migrations.slice(0, 1));
    toplistSnapshotStore(first).put(snapshot);
    first.close();

    const db = openDatabase(path);

    expect(schemaVersion(db)).toBe(Migrations.length);
    expect(toplistSnapshotStore(db).get("yesterday")).toEqual(snapshot);
    expect(egressStateStore(db).get("mock")).toBeNull();
    db.close();
  });

  test("a database migrated by a newer server is refused", () => {
    const path = databasePath();
    openDatabase(path, ["CREATE TABLE first (x INTEGER) STRICT;", "SELECT 1;"]).close();

    expect(() => openDatabase(path, ["CREATE TABLE first (x INTEGER) STRICT;"])).toThrow(
      "database schema 2 is newer than this server's 1",
    );
  });
});
