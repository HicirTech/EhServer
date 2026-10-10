/** `Server-Timing` (nfr.md OBS-2): how long each part of answering a request took. */
export type TimingPart = "queue" | "upstream" | "parse" | "store";

export interface Timing {
  measure<T>(part: TimingPart, work: () => T): T;
  /** `store;dur=0.4, total;dur=1.2`, in milliseconds. */
  header(totalMs: number): string;
}

export function createTiming(now: () => number = () => performance.now()): Timing {
  const spent = new Map<TimingPart, number>();
  return {
    measure: (part, work) => {
      const start = now();
      try {
        return work();
      } finally {
        spent.set(part, (spent.get(part) ?? 0) + now() - start);
      }
    },
    header: (totalMs) =>
      [...spent, ["total", totalMs] as const]
        .map(([part, ms]) => `${part};dur=${ms.toFixed(1)}`)
        .join(", "),
  };
}
