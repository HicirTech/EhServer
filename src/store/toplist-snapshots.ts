/** Toplist snapshots (ADR-0010): one per toplist, replaced whole by the next complete walk. */
import type { Database } from "bun:sqlite";

import type { ToplistPeriod } from "../domain/toplist";
import type { ToplistEntryReading } from "../eh-core/toplist-page";
import { readInstant } from "./instant";

export interface ToplistSnapshot {
  readonly period: ToplistPeriod;
  /** When the walk that made it ended. */
  readonly observedAt: Date;
  /** In rank order. */
  readonly entries: readonly ToplistEntryReading[];
}

export interface ToplistSnapshotStore {
  get(period: ToplistPeriod): ToplistSnapshot | null;
  put(snapshot: ToplistSnapshot): void;
}

/** Only the galleries toplists are served for now (ADR-0010). */
const GalleriesType = "galleries";

interface EntryRow {
  readonly rank: number;
  readonly score: number;
  readonly gid: number;
  readonly token: string;
}

export function toplistSnapshotStore(db: Database): ToplistSnapshotStore {
  const selectSnapshot = db.query<{ observed_at: string }, [string, string]>(
    "SELECT observed_at FROM toplist_snapshots WHERE type = ? AND period = ?",
  );
  const selectEntries = db.query<EntryRow, [string, string]>(
    "SELECT rank, score, gid, token FROM toplist_entries WHERE type = ? AND period = ? ORDER BY rank",
  );
  const deleteSnapshot = db.query<unknown, [string, string]>(
    "DELETE FROM toplist_snapshots WHERE type = ? AND period = ?",
  );
  const insertSnapshot = db.query<unknown, [string, string, string]>(
    "INSERT INTO toplist_snapshots (type, period, observed_at) VALUES (?, ?, ?)",
  );
  const insertEntry = db.query<unknown, [string, string, number, number, number, string]>(
    "INSERT INTO toplist_entries (type, period, rank, score, gid, token) VALUES (?, ?, ?, ?, ?, ?)",
  );

  /** Deleting the snapshot deletes its entries, so a put never leaves rows of the last one. */
  const put = db.transaction((snapshot: ToplistSnapshot) => {
    deleteSnapshot.run(GalleriesType, snapshot.period);
    insertSnapshot.run(GalleriesType, snapshot.period, snapshot.observedAt.toISOString());
    for (const { rank, score, gallery } of snapshot.entries) {
      insertEntry.run(GalleriesType, snapshot.period, rank, score, gallery.gid, gallery.token);
    }
  });

  return {
    get: (period) => {
      const snapshot = selectSnapshot.get(GalleriesType, period);
      if (snapshot === null) {
        return null;
      }

      return {
        period,
        observedAt: readInstant(snapshot.observed_at, "toplist_snapshots.observed_at"),
        entries: selectEntries
          .all(GalleriesType, period)
          .map(({ rank, score, gid, token }) => ({ rank, score, gallery: { gid, token } })),
      };
    },
    put: (snapshot) => put(snapshot),
  };
}
