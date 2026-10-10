import { describe, expect, test } from "bun:test";

import {
  readBanExpiry,
  readCommentTime,
  readEpochSeconds,
  readInteger,
  readSiteTime,
} from "../../src/eh-core/decoders";

describe("decoders", () => {
  type ExpiryCase = [text: string, seconds: number | null];

  test.each<ExpiryCase>([
    ["The ban expires in 59 minutes and 48 seconds", 59 * 60 + 48],
    ["The ban expires in 1 hour, 2 minutes and 3 seconds", 3600 + 120 + 3],
    ["The ban expires in 2 days and 1 hour.", 2 * 86400 + 3600],
    ["The ban expires in a while", null],
    ["The ban expires in 3 weeks", null],
  ])("reads %p as %p seconds", (text, seconds) => {
    expect(readBanExpiry(text)).toBe(seconds);
  });

  test("site times are UTC, and impossible dates are refused", () => {
    expect(readSiteTime("2026-09-01 12:34")).toBe("2026-09-01T12:34:00Z");
    expect(readSiteTime("2026-02-30 12:34")).toBeNull();
    expect(readSiteTime("2026-09-01 24:00")).toBeNull();
  });

  test("comment times name the month in English", () => {
    expect(readCommentTime("26 September 2026, 09:15")).toBe("2026-09-26T09:15:00Z");
    expect(readCommentTime("26 Septembre 2026, 09:15")).toBeNull();
  });

  test("gdata times are epoch seconds, as a string or a number", () => {
    expect(readEpochSeconds("1788265440")).toBe("2026-09-01T12:24:00Z");
    expect(readEpochSeconds(1788265440)).toBe("2026-09-01T12:24:00Z");
    expect(readEpochSeconds("soon")).toBeNull();
  });

  test("integers may use thousands separators, but only in their places", () => {
    expect(readInteger("1,234")).toBe(1234);
    expect(readInteger("5277323")).toBe(5277323);
    expect(readInteger("1,23")).toBeNull();
    expect(readInteger("-1")).toBeNull();
  });
});
