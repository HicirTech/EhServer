/** Stored toplist snapshots (ADR-0010; domain-model.md I8). */
import { describe, expect, test } from "bun:test";

import type { ToplistEntryReading } from "../../src/eh-core/toplist-page";
import { openDatabase } from "../../src/store/database";
import { type ToplistSnapshot, toplistSnapshotStore } from "../../src/store/toplist-snapshots";

function entries(count: number, firstGid = 9000001): ToplistEntryReading[] {
  return Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    score: 1_000 * (count - index),
    gallery: { gid: firstGid + index, token: "a1b2c3d4e5" },
  }));
}

function snapshot(overrides: Partial<ToplistSnapshot> = {}): ToplistSnapshot {
  return {
    period: "yesterday",
    observedAt: new Date("2026-10-11T08:00:00.000Z"),
    entries: entries(3),
    ...overrides,
  };
}

describe("toplistSnapshotStore", () => {
  test("I8: a snapshot reads back whole, in rank order", () => {
    const store = toplistSnapshotStore(openDatabase(":memory:"));

    store.put(snapshot());

    expect(store.get("yesterday")).toEqual(snapshot());
  });

  test("I8: the next snapshot replaces every entry of the last one", () => {
    const store = toplistSnapshotStore(openDatabase(":memory:"));
    store.put(snapshot({ entries: entries(3) }));

    store.put(snapshot({ entries: entries(2, 9000100) }));

    expect(store.get("yesterday")?.entries).toEqual(entries(2, 9000100));
  });

  test("each period has its own snapshot, and a period without one reads as null", () => {
    const store = toplistSnapshotStore(openDatabase(":memory:"));
    store.put(snapshot({ period: "allTime" }));

    expect(store.get("allTime")?.period).toBe("allTime");
    expect(store.get("pastMonth")).toBeNull();
  });

  test("a damaged instant fails loudly instead of reading as a time", () => {
    const db = openDatabase(":memory:");
    const store = toplistSnapshotStore(db);
    store.put(snapshot());
    db.exec("UPDATE toplist_snapshots SET observed_at = 'soon'");

    expect(() => store.get("yesterday")).toThrow("toplist_snapshots.observed_at is not an instant");
  });
});
