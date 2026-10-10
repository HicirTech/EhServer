/** RFC 9457 problem responses with a code from docs/outcomes.md (ADR-0008). */
import { type ProblemCode, problemEntry } from "../domain/outcomes";

const ProblemType = "https://github.com/HicirTech/EhServer/blob/main/docs/outcomes.md#4-codes";

export interface ProblemOptions {
  /** What happened, in words; for a site failure, the site's own words when it gave any. */
  readonly detail?: string;
  readonly retryAfterSeconds?: number;
  readonly headers?: Readonly<Record<string, string>>;
}

export function problemResponse(
  code: ProblemCode,
  requestId: string,
  { detail, retryAfterSeconds, headers = {} }: ProblemOptions = {},
): Response {
  const { status, clientAction, title } = problemEntry(code);
  if (status === null || clientAction === null) {
    throw new Error(`outcome ${code} sends no response`);
  }

  const retry = retryAfterSeconds === undefined ? {} : { "Retry-After": String(retryAfterSeconds) };
  return Response.json(
    {
      type: ProblemType,
      title,
      status,
      code,
      clientAction,
      ...(retryAfterSeconds === undefined ? {} : { retryAfter: retryAfterSeconds }),
      requestId,
      ...(detail === undefined || detail === "" ? {} : { detail }),
    },
    { status, headers: { "Content-Type": "application/problem+json", ...retry, ...headers } },
  );
}
