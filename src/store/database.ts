/** The one SQLite database in the data directory (ADR-0004), in WAL mode and fully migrated. */
import { Database } from "bun:sqlite";

import { Migrations } from "./migrations";

export function openDatabase(path: string, migrations: readonly string[] = Migrations): Database {
  const db = new Database(path, { create: true, strict: true });
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    migrate(db, migrations);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function schemaVersion(db: Database): number {
  return db.query<{ user_version: number }, []>("PRAGMA user_version;").get()?.user_version ?? 0;
}

/** Each pending step runs in its own transaction together with the version it brings. */
function migrate(db: Database, migrations: readonly string[]): void {
  const version = schemaVersion(db);
  if (version > migrations.length) {
    throw new Error(`database schema ${version} is newer than this server's ${migrations.length}`);
  }

  for (const [index, step] of migrations.entries()) {
    if (index >= version) {
      db.transaction(() => {
        db.exec(step);
        db.exec(`PRAGMA user_version = ${index + 1};`);
      })();
    }
  }
}
