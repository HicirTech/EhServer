/** An instant the store wrote as ISO 8601 text (domain-model.md I6); a damaged one fails loudly. */
export function readInstant(text: string, column: string): Date {
  const instant = new Date(text);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`${column} is not an instant: ${text}`);
  }

  return instant;
}
