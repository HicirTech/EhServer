/** Structured logs and the one redactor (nfr.md OBS-3, SEC-1). */
import { describe, expect, test } from "bun:test";

import { createLogger } from "../../src/log/logger";

function capture() {
  const lines: string[] = [];
  const log = createLogger(
    (line) => lines.push(line),
    () => new Date("2026-10-11T12:00:00Z"),
  );
  return { log, entries: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>) };
}

describe("logger", () => {
  test("OBS-3: one JSON object a line, with the time, level, event and fields", () => {
    const { log, entries } = capture();

    log.info("server started", { url: "http://127.0.0.1:8080" });

    expect(entries()).toEqual([
      {
        time: "2026-10-11T12:00:00.000Z",
        level: "info",
        event: "server started",
        url: "http://127.0.0.1:8080",
      },
    ]);
  });

  test.each([
    "ipb_member_id",
    "ipb_pass_hash",
    "igneous",
    "iq",
    "apikey",
    "cookie",
    "authorization",
    "password",
    "token",
  ])("SEC-1: a %p field never reaches the log, at any depth and in any case", (name) => {
    const { log, entries } = capture();

    log.error("request failed", { [name]: "secret", nested: { [name.toUpperCase()]: "secret" } });

    expect(JSON.stringify(entries())).not.toContain("secret");
    expect(entries()[0]).toMatchObject({
      [name]: "[redacted]",
      nested: { [name.toUpperCase()]: "[redacted]" },
    });
  });

  test("an error is logged by its name and message", () => {
    const { log, entries } = capture();

    log.error("request failed", { error: new TypeError("no snapshot table") });

    expect(entries()[0]?.error).toEqual({ name: "TypeError", message: "no snapshot table" });
  });

  test("a field cannot pass itself off as the level or the event", () => {
    const { log, entries } = capture();

    log.info("started", { level: "error", event: "spoofed" });

    expect(entries()[0]).toMatchObject({ level: "info", event: "started" });
  });
});
