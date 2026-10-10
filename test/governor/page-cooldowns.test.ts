/** Page cooldowns after failure outcomes (outcomes.md section 4; nfr.md H2). */
import { describe, expect, test } from "bun:test";

import { type FailureCode, failure } from "../../src/eh-core/parse-result";
import { pageCooldownMs } from "../../src/governor/page-cooldowns";

const Minute = 60_000;

describe("pageCooldownMs", () => {
  test.each<[name: string, code: FailureCode, retryAfterSeconds: number | undefined, ms: number]>([
    ["a rate limit rests as long as the site says", "upstream_rate_limited", 120, 2 * Minute],
    ["a Cloudflare challenge rests 30 minutes", "cloudflare_challenge", undefined, 30 * Minute],
    ["an unavailable site rests a minute", "upstream_unavailable", undefined, Minute],
    ["the too-fast warning rests 15 minutes", "too_fast_warning", undefined, 15 * Minute],
    ["a ban rests until it expires, plus a tenth", "ip_banned", 600, 11 * Minute],
    ["a ban without an expiry rests an hour", "ip_banned", undefined, 60 * Minute],
    ["a removed gallery concerns only its request", "gallery_removed", undefined, 0],
  ])("H2: %s", (_name, code, retryAfterSeconds, ms) => {
    expect(pageCooldownMs(failure(code, "", retryAfterSeconds))).toBe(ms);
  });
});
