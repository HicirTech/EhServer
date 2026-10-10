/** The database and its migrations (ADR-0004; nfr.md REL-3, OPS-1). */
import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openDatabase, schemaVersion } from "../../src/store/database";
import { Migrations } from "../../src/store/migrations";

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

  test("a database migrated by a newer server is refused", () => {
    const path = databasePath();
    openDatabase(path, ["CREATE TABLE first (x INTEGER) STRICT;", "SELECT 1;"]).close();

    expect(() => openDatabase(path, ["CREATE TABLE first (x INTEGER) STRICT;"])).toThrow(
      "database schema 2 is newer than this server's 1",
    );
  });
});
