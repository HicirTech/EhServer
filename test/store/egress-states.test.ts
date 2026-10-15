/** Stored egress cooldowns (ADR-0005; nfr.md REL-3, H2). */
import { describe, expect, test } from "bun:test";

import { openDatabase } from "../../src/store/database";
import { type EgressState, egressStateStore } from "../../src/store/egress-states";

function state(overrides: Partial<EgressState> = {}): EgressState {
  return {
    cooldownUntil: new Date("2026-10-15T08:15:00.000Z"),
    reason: "too_fast_warning",
    slowedUntil: new Date("2026-10-16T08:00:00.000Z"),
    ...overrides,
  };
}

describe("egressStateStore", () => {
  test("REL-3: a cooldown reads back as it was stored", () => {
    const store = egressStateStore(openDatabase(":memory:"));

    store.put("mock", state());

    expect(store.get("mock")).toEqual(state());
  });

  test("a rate that was never halved reads back as such", () => {
    const store = egressStateStore(openDatabase(":memory:"));
    const limited = state({ reason: "upstream_rate_limited", slowedUntil: null });

    store.put("mock", limited);

    expect(store.get("mock")).toEqual(limited);
  });

  test("the next cooldown replaces the last", () => {
    const store = egressStateStore(openDatabase(":memory:"));
    store.put("mock", state());
    const banned = state({
      cooldownUntil: new Date("2026-10-15T10:00:00.000Z"),
      reason: "ip_banned",
    });

    store.put("mock", banned);

    expect(store.get("mock")).toEqual(banned);
  });

  test("each egress has its own state, and one without any reads as null", () => {
    const store = egressStateStore(openDatabase(":memory:"));
    store.put("proxy:a", state());

    expect(store.get("proxy:a")).toEqual(state());
    expect(store.get("proxy:b")).toBeNull();
  });

  test.each<[column: string]>([["cooldown_until"], ["slowed_until"]])(
    "a damaged %s fails loudly instead of reading as a time",
    (column) => {
      const db = openDatabase(":memory:");
      const store = egressStateStore(db);
      store.put("mock", state());
      db.exec(`UPDATE egress_states SET ${column} = 'soon'`);

      expect(() => store.get("mock")).toThrow(`egress_states.${column} is not an instant: soon`);
    },
  );

  test("an unknown reason fails loudly instead of reading as an outcome", () => {
    const db = openDatabase(":memory:");
    const store = egressStateStore(db);
    store.put("mock", state());
    db.exec("UPDATE egress_states SET reason = 'tired'");

    expect(() => store.get("mock")).toThrow("egress_states.reason is not an outcome code: tired");
  });
});
