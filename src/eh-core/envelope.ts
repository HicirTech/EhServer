/**
 * The cross-cutting part of response classification (docs/outcomes.md section 2, steps 3–5): the
 * signals any upstream response can carry, checked before an operation's own parser runs.
 */
import { readBanExpiry } from "./decoders";
import { type Failure, failure, type Unrecognized, unrecognized } from "./parse-result";

export type Site = "eh" | "ex";

export interface UpstreamResponse {
  readonly site: Site;
  readonly status: number;
  readonly headers: Headers;
  readonly body: string;
}

const BanPrefix = "Your IP address has been temporarily banned for excessive pageloads";
const TooFastPrefix = "You are opening";
/** Matched in the title only, so a comment quoting the error cannot trigger it. */
const BackendFetchFailedTitle = /<title>[^<]*Backend fetch failed[^<]*<\/title>/;
const KokomadeImage = "https://exhentai.org/img/kokomade.jpg";
/** The file name is decisive; the length clients also check changes under compression. */
const SadPandaDisposition = 'inline; filename="sadpanda.jpg"';
const DefaultRetryAfterSeconds = 60;

/** A failure or an unrecognized response, or null when the operation's parser should run. */
export function classifyEnvelope(response: UpstreamResponse): Failure | Unrecognized | null {
  return classifyStatus(response) ?? classifySadPanda(response) ?? classifyBody(response);
}

function classifyStatus({ status, headers }: UpstreamResponse): Failure | Unrecognized | null {
  if (status === 429) {
    const retryAfter = Number(headers.get("retry-after"));
    return failure(
      "upstream_rate_limited",
      "",
      Number.isInteger(retryAfter) && retryAfter > 0 ? retryAfter : DefaultRetryAfterSeconds,
    );
  }

  if (status === 403 && headers.get("cf-mitigated") === "challenge") {
    return failure("cloudflare_challenge");
  }

  if (status >= 500) {
    return failure("upstream_unavailable", `HTTP ${status}`);
  }

  return status === 200 ? null : unrecognized("HTTP status", String(status));
}

function classifySadPanda({ headers }: UpstreamResponse): Failure | null {
  const isSadPanda =
    headers.get("content-disposition") === SadPandaDisposition &&
    headers.get("content-type") === "image/gif";
  return isSadPanda ? failure("sad_panda") : null;
}

function classifyBody({ site, body }: UpstreamResponse): Failure | Unrecognized | null {
  const text = body.trimStart();
  if (text === "") {
    // ExHentai answers an account without access with an empty page; on E-Hentai the cause is unknown.
    return site === "ex" ? failure("sad_panda", "empty body") : unrecognized("body", "");
  }

  if (text.startsWith(BanPrefix)) {
    const expiry = readBanExpiry(text);
    return expiry === null ? failure("ip_banned", text) : failure("ip_banned", text, expiry);
  }

  if (text.startsWith(TooFastPrefix)) {
    return failure("too_fast_warning", text);
  }

  if (BackendFetchFailedTitle.test(text)) {
    return failure("upstream_unavailable", "Backend fetch failed");
  }

  return text.includes(KokomadeImage) ? failure("sad_panda", "kokomade") : null;
}
