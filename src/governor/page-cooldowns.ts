/**
 * How long page loads on an egress rest after a failure outcome, and how long they then run at half
 * rate (outcomes.md section 4; initial values). An outcome that concerns only its own request, or
 * only images or one account, rests nothing.
 */
import type { Failure, FailureCode } from "../eh-core/parse-result";

const MinuteMs = 60_000;
const HourMs = 60 * MinuteMs;
const BanMargin = 1.1;
const TooFastSlowdownMs = 24 * HourMs;

const PageCooldowns: Readonly<Record<FailureCode, (failure: Failure) => number>> = {
  upstream_rate_limited: (failure) => toldMs(failure) ?? MinuteMs,
  cloudflare_challenge: () => 30 * MinuteMs,
  upstream_unavailable: () => MinuteMs,
  too_fast_warning: () => 15 * MinuteMs,
  ip_banned: (failure) => {
    const told = toldMs(failure);
    return told === null ? HourMs : told * BanMargin;
  },
  quota_exhausted: () => 0,
  signed_out: () => 0,
  sad_panda: () => 0,
  gallery_removed: () => 0,
  gallery_unavailable: () => 0,
  invalid_token: () => 0,
  content_warning: () => 0,
  site_error: () => 0,
};

export function pageCooldownMs(failure: Failure): number {
  return PageCooldowns[failure.code](failure);
}

export function pageSlowdownMs(failure: Failure): number {
  return failure.code === "too_fast_warning" ? TooFastSlowdownMs : 0;
}

function toldMs(failure: Failure): number | null {
  return failure.retryAfterSeconds === undefined ? null : failure.retryAfterSeconds * 1000;
}
