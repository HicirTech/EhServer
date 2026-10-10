import { type Unrecognized, unrecognized } from "./readings";

/** Thrown inside an assembler when a field is missing or unreadable; `assembling` returns it. */
class UnrecognizedField extends Error {
  constructor(
    readonly marker: string,
    readonly raw: string,
  ) {
    super(`unrecognized ${marker}`);
  }
}

/** The decoded value, or an unrecognized result naming where on the page it should have been. */
export function need<T>(value: T | null | undefined, marker: string, raw: string | undefined): T {
  if (value === null || value === undefined) {
    throw new UnrecognizedField(marker, raw ?? "");
  }

  return value;
}

export function assembling<T>(assemble: () => T): T | Unrecognized {
  try {
    return assemble();
  } catch (error) {
    if (error instanceof UnrecognizedField) {
      return unrecognized(error.marker, error.raw);
    }

    throw error;
  }
}
