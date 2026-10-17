/** Whether `value` is one of `values`, a closed set such as an enum of the contract. */
export function isOneOf<T extends string>(
  values: readonly T[],
  value: string | null | undefined,
): value is T {
  return values.some((known) => known === value);
}
