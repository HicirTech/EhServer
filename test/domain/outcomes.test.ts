/** The outcome catalog in code says what docs/outcomes.md says (outcomes.md R3, R7). */
import { describe, expect, test } from "bun:test";

import {
  type CatalogEntry,
  type ClientAction,
  type OutcomeKind,
  Outcomes,
  ServerConditions,
} from "../../src/domain/outcomes";

interface DocumentedCode {
  readonly kind: OutcomeKind;
  readonly status: number | null;
  readonly clientAction: ClientAction | null;
}

/** The rows of every table in section 4 whose header names a code, a status and a client action. */
async function documentedTables(): Promise<Map<string, DocumentedCode>[]> {
  const text = await Bun.file(`${import.meta.dir}/../../docs/outcomes.md`).text();
  const section = text.slice(text.indexOf("## 4. Codes"), text.indexOf("## 5."));
  const tables = section.split(/\n\n/).filter((block) => block.startsWith("| Code |"));
  return tables.map((table) => {
    const [header = "", , ...rows] = table.trim().split("\n");
    const columns = cells(header);
    const at = (name: string) => columns.indexOf(name);
    return new Map(
      rows.map((row) => {
        const values = cells(row);
        const value = (name: string) => (at(name) < 0 ? undefined : values[at(name)]);
        const status = /^\d+/.exec(value("API status") ?? "")?.[0];
        const action = value("Client action")?.replaceAll("`", "");
        return [
          (value("Code") ?? "").replaceAll("`", ""),
          {
            kind: (value("Kind") ?? "failure") as OutcomeKind,
            status: status === undefined ? null : Number(status),
            clientAction: action === "—" ? null : (action as ClientAction),
          },
        ];
      }),
    );
  });
}

function cells(row: string): string[] {
  return row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function withoutTitles(catalog: Readonly<Record<string, CatalogEntry>>) {
  return new Map(
    Object.entries(catalog).map(([code, { kind, status, clientAction }]) => [
      code,
      { kind, status, clientAction },
    ]),
  );
}

describe("outcome catalog", () => {
  test("R7: every upstream outcome has the kind, status and client action the document gives", async () => {
    const [outcomes] = await documentedTables();

    expect(withoutTitles(Outcomes)).toEqual(outcomes ?? new Map());
  });

  test("R7: EhServer's own conditions match the document's second table", async () => {
    const [, conditions] = await documentedTables();

    expect(withoutTitles(ServerConditions)).toEqual(conditions ?? new Map());
  });
});
