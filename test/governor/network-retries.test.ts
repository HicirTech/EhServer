/** outcomes.md `network`: retried twice with backoff, then the step fails. */
import { describe, expect, test } from "bun:test";

import { withNetworkRetries } from "../../src/governor/network-retries";

function flakySend(failures: number) {
  let calls = 0;
  const send = async (argument: string) => {
    calls++;
    if (calls <= failures) {
      throw new Error(`no answer ${calls}`);
    }

    return `answer to ${argument}`;
  };
  return { send, calls: () => calls };
}

describe("withNetworkRetries", () => {
  test("an answer after two failures is returned, after pauses of 2 and 8 s", async () => {
    const { send, calls } = flakySend(2);
    const pauses: number[] = [];

    const answer = await withNetworkRetries(send, async (ms) => {
      pauses.push(ms);
    })("page");

    expect(answer).toBe("answer to page");
    expect(calls()).toBe(3);
    expect(pauses).toEqual([2_000, 8_000]);
  });

  test("a third failure is the step's failure", async () => {
    const { send, calls } = flakySend(3);

    await expect(withNetworkRetries(send, async () => {})("page")).rejects.toThrow("no answer 3");
    expect(calls()).toBe(3);
  });

  test("an answer at once costs no pause", async () => {
    const { send } = flakySend(0);
    const pauses: number[] = [];

    await withNetworkRetries(send, async (ms) => {
      pauses.push(ms);
    })("page");

    expect(pauses).toEqual([]);
  });
});
