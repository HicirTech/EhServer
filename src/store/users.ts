/** Users (ADR-0006): who may hold API tokens, each with a unique name. */
import type { Database } from "bun:sqlite";

import { readInstant } from "./instant";

export interface User {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
}

export interface UserStore {
  /** Null when another user has the name. */
  create(name: string, createdAt: Date): User | null;
  byId(id: string): User | null;
  byName(name: string): User | null;
  /** By name. */
  list(): User[];
}

interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
}

export function userStore(db: Database): UserStore {
  const insertUser = db.query<unknown, [string, string, string]>(
    "INSERT INTO users (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT (name) DO NOTHING",
  );
  const selectById = db.query<UserRow, [string]>(
    "SELECT id, name, created_at FROM users WHERE id = ?",
  );
  const selectByName = db.query<UserRow, [string]>(
    "SELECT id, name, created_at FROM users WHERE name = ?",
  );
  const selectAll = db.query<UserRow, []>("SELECT id, name, created_at FROM users ORDER BY name");

  return {
    create: (name, createdAt) => {
      const id = `usr_${crypto.randomUUID()}`;
      const { changes } = insertUser.run(id, name, createdAt.toISOString());
      return changes === 0 ? null : { id, name, createdAt };
    },
    byId: (id) => {
      const row = selectById.get(id);
      return row === null ? null : readUser(row);
    },
    byName: (name) => {
      const row = selectByName.get(name);
      return row === null ? null : readUser(row);
    },
    list: () => selectAll.all().map(readUser),
  };
}

function readUser({ id, name, created_at }: UserRow): User {
  return { id, name, createdAt: readInstant(created_at, "users.created_at") };
}
