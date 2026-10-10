/**
 * outcomes.md `network`: a request that got no answer is tried twice more, each time after a longer
 * pause, before its step fails.
 */
const NetworkRetryDelaysMs = [2_000, 8_000];

/** `send` throws only for transport errors; every answer, an error status included, resolves. */
export function withNetworkRetries<A, R>(
  send: (argument: A) => Promise<R>,
  sleep: (ms: number) => Promise<void>,
): (argument: A) => Promise<R> {
  return async (argument) => {
    for (const delay of NetworkRetryDelaysMs) {
      try {
        return await send(argument);
      } catch {
        await sleep(delay);
      }
    }

    return send(argument);
  };
}
