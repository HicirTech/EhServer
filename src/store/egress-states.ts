/** Each egress's cooldown (ADR-0005), kept so that it outlives the server that started it (REL-3). */
import type { Database } from "bun:sqlite";

import { isOutcomeCode, type OutcomeCode } from "../domain/outcomes";
import { readInstant } from "./instant";

export interface EgressState {
  /** No page load starts before then. */
  readonly cooldownUntil: Date;
  /** The outcome that started the cooldown. */
  readonly reason: OutcomeCode;
  /** Page loads run at half rate until then; null when the rate was never halved. */
  readonly slowedUntil: Date | null;
}

export interface EgressStateStore {
  get(egressId: string): EgressState | null;
  put(egressId: string, state: EgressState): void;
}

interface StateRow {
  readonly cooldown_until: string;
  readonly reason: string;
  readonly slowed_until: string | null;
}

export function egressStateStore(db: Database): EgressStateStore {
  const selectState = db.query<StateRow, [string]>(
    "SELECT cooldown_until, reason, slowed_until FROM egress_states WHERE egress_id = ?",
  );
  const putState = db.query<unknown, [string, string, string, string | null]>(
    `INSERT INTO egress_states (egress_id, cooldown_until, reason, slowed_until) VALUES (?, ?, ?, ?)
    ON CONFLICT (egress_id) DO UPDATE SET cooldown_until = excluded.cooldown_until,
      reason = excluded.reason, slowed_until = excluded.slowed_until`,
  );

  return {
    get: (egressId) => {
      const row = selectState.get(egressId);
      return row === null ? null : readState(row);
    },
    put: (egressId, { cooldownUntil, reason, slowedUntil }) => {
      putState.run(
        egressId,
        cooldownUntil.toISOString(),
        reason,
        slowedUntil?.toISOString() ?? null,
      );
    },
  };
}

function readState(row: StateRow): EgressState {
  if (!isOutcomeCode(row.reason)) {
    throw new Error(`egress_states.reason is not an outcome code: ${row.reason}`);
  }

  return {
    cooldownUntil: readInstant(row.cooldown_until, "egress_states.cooldown_until"),
    reason: row.reason,
    slowedUntil:
      row.slowed_until === null
        ? null
        : readInstant(row.slowed_until, "egress_states.slowed_until"),
  };
}
