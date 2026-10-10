/** Cross-cutting classification (docs/outcomes.md section 2; nfr.md REL-1, TEST-1). */
import { describe, expect, test } from "bun:test";

import { type FaultName, faultResponse, RetryAfterSeconds } from "../../mock/faults";
import { classifyEnvelope, type UpstreamResponse } from "../../src/eh-core/envelope";
import type { FailureCode } from "../../src/eh-core/parse-result";

function response(overrides: Partial<UpstreamResponse> = {}): UpstreamResponse {
  return {
    site: "eh",
    status: 200,
    headers: new Headers({ "content-type": "text/html; charset=UTF-8" }),
    body: "<html><body><p>An ordinary page.</p></body></html>",
    ...overrides,
  };
}

async function fromMock(fault: FaultName, site: "eh" | "ex" = "eh"): Promise<UpstreamResponse> {
  const answer = await faultResponse(fault, new Request("http://mock/"));
  return response({
    site,
    status: answer.status,
    headers: answer.headers,
    body: await answer.text(),
  });
}

describe("classifyEnvelope", () => {
  test("an ordinary page goes on to its own parser", () => {
    expect(classifyEnvelope(response())).toBeNull();
  });

  type MockCase = [fault: FaultName, site: "eh" | "ex", code: FailureCode];

  test.each<MockCase>([
    ["http_429", "eh", "upstream_rate_limited"],
    ["cloudflare_403", "eh", "cloudflare_challenge"],
    ["backend_fetch_failed", "eh", "upstream_unavailable"],
    ["empty_body", "ex", "sad_panda"],
    ["ban_text", "eh", "ip_banned"],
    ["too_fast_text", "eh", "too_fast_warning"],
    ["sad_panda", "ex", "sad_panda"],
    ["kokomade", "ex", "sad_panda"],
  ])("TEST-1: the mock's %p on %p is %p", async (fault, site, code) => {
    expect(classifyEnvelope(await fromMock(fault, site))).toMatchObject({ kind: "failure", code });
  });

  test("a 429 carries the wait from Retry-After, or 60 seconds without one", () => {
    const withHeader = response({ status: 429, headers: new Headers({ "retry-after": "120" }) });
    const without = response({ status: 429, headers: new Headers() });

    expect(classifyEnvelope(withHeader)).toMatchObject({ retryAfterSeconds: RetryAfterSeconds });
    expect(classifyEnvelope(without)).toMatchObject({ retryAfterSeconds: 60 });
  });

  test("a ban carries the time it expires in", async () => {
    expect(classifyEnvelope(await fromMock("ban_text"))).toMatchObject({
      code: "ip_banned",
      retryAfterSeconds: 59 * 60 + 48,
    });
  });

  test("a ban whose expiry cannot be read is still a ban, without a wait", () => {
    const body =
      "Your IP address has been temporarily banned for excessive pageloads. The ban expires soon";

    const result = classifyEnvelope(response({ body }));

    expect(result).toMatchObject({ kind: "failure", code: "ip_banned" });
    expect(result).not.toHaveProperty("retryAfterSeconds");
  });

  test("REL-1, H5: an empty page from E-Hentai is unrecognized, because its cause is unknown", () => {
    expect(classifyEnvelope(response({ body: "" }))).toEqual({
      kind: "unrecognized",
      marker: "body",
      raw: "",
    });
  });

  test("REL-1, H5: a 403 without a challenge and an unexpected status are unrecognized", () => {
    expect(classifyEnvelope(response({ status: 403 }))).toMatchObject({
      kind: "unrecognized",
      raw: "403",
    });
    expect(classifyEnvelope(response({ status: 404 }))).toMatchObject({
      kind: "unrecognized",
      raw: "404",
    });
  });

  test("a comment quoting 'Backend fetch failed' does not make the page a failure", () => {
    const body =
      "<html><head><title>Gallery</title></head><body>Backend fetch failed again?</body></html>";

    expect(classifyEnvelope(response({ body }))).toBeNull();
  });
});
