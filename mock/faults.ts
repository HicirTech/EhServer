import { contentWarningPageHtml, errorBoxPageHtml } from "../fixtures/eh/detail-page";

/**
 * Upstream behaviours the mock can put in place of a normal answer. Each name says what the site
 * does, not what EhServer concludes; the README maps every one to its outcome code.
 */
export const FaultNames = [
  "connection_reset",
  "no_answer",
  "http_429",
  "cloudflare_403",
  "backend_fetch_failed",
  "empty_body",
  "ban_text",
  "too_fast_text",
  "sad_panda",
  "kokomade",
  "content_warning",
  "gallery_removed",
  "gallery_unavailable",
  "key_missing",
  "error_box",
] as const;

export type FaultName = (typeof FaultNames)[number];

export const RetryAfterSeconds = 120;

/** The site's answer to a gallery URL with a wrong token. */
export const KeyMissingText = "Key missing, or incorrect key provided.";

/** Clients recognize Sad Panda by its headers and this length; the bytes are a stand-in GIF. */
const SadPandaGif = new Uint8Array(9615);
SadPandaGif.set(new TextEncoder().encode("GIF89a"));

/** From a community capture: plain text, no HTML. */
const BanText =
  "Your IP address has been temporarily banned for excessive pageloads which indicates that you are using automated mirroring/harvesting software. The ban expires in 59 minutes and 48 seconds";

/** Clients only match the prefix "You are opening"; the rest of this text is unconfirmed. */
const TooFastText =
  "You are opening pages too fast, thus placing a heavy load on the server. Back down, or your IP address will be automatically banned.";

const Faults: Readonly<Record<FaultName, (request: Request) => Response | Promise<Response>>> = {
  connection_reset: () =>
    new Response(partThenReset(), { headers: { "content-type": "text/html" } }),
  no_answer: (request) =>
    new Promise((resolve) => {
      request.signal.addEventListener("abort", () => resolve(new Response(null, { status: 499 })));
    }),
  http_429: () =>
    new Response("", { status: 429, headers: { "retry-after": String(RetryAfterSeconds) } }),
  cloudflare_403: () =>
    html(
      "<!DOCTYPE html><html><head><title>Just a moment...</title></head><body></body></html>",
      403,
      { "cf-mitigated": "challenge", server: "cloudflare" },
    ),
  backend_fetch_failed: () =>
    html(
      "<html><head><title>503 Backend fetch failed</title></head><body><h1>Error 503 Backend fetch failed</h1></body></html>",
      503,
    ),
  empty_body: () => html("", 200),
  ban_text: () => html(BanText, 200),
  too_fast_text: () => html(TooFastText, 200),
  sad_panda: () =>
    new Response(SadPandaGif, {
      headers: {
        "content-type": "image/gif",
        "content-disposition": 'inline; filename="sadpanda.jpg"',
      },
    }),
  kokomade: () =>
    html('<html><body><img src="https://exhentai.org/img/kokomade.jpg" /></body></html>', 200),
  content_warning: () => html(contentWarningPageHtml(), 200),
  gallery_removed: () => html(errorBoxPageHtml("This gallery is pining for the fjords."), 200),
  gallery_unavailable: () =>
    html(
      errorBoxPageHtml(
        "This gallery is unavailable due to a copyright claim by Synthetic Rights Holder.",
      ),
      200,
    ),
  key_missing: () => html(errorBoxPageHtml(KeyMissingText), 200),
  error_box: () => html(errorBoxPageHtml("Synthetic site error."), 200),
};

/** Sends the start of a page, then drops the connection, so the client fails mid-body. */
function partThenReset(): ReadableStream<Uint8Array> {
  let hasSentPart = false;
  return new ReadableStream({
    async pull(controller) {
      if (hasSentPart) {
        // Bun sends a body it can read in one go as a complete response; let the part go out first.
        await new Promise((resolve) => setImmediate(resolve));
        controller.error(new Error("mock: connection reset"));
        return;
      }

      hasSentPart = true;
      controller.enqueue(new TextEncoder().encode("<html><body>"));
    },
  });
}

export function isFaultName(value: unknown): value is FaultName {
  return typeof value === "string" && (FaultNames as readonly string[]).includes(value);
}

export function faultResponse(fault: FaultName, request: Request): Response | Promise<Response> {
  return Faults[fault](request);
}

export function html(body: string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=UTF-8", ...headers },
  });
}
