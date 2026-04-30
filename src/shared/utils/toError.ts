/**
 * Coerces an unknown caught value into an Error so it can be posted back to
 * the main thread without losing the message.
 *
 * @param value - The caught value (typically from `catch (e) {}`).
 * @returns An Error preserving the original value's message.
 */
export const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));
