/**
 * Owns original test oracle shared test handwritten expected data and bounded contract assertions. Inputs are supplied
 * plans or observed tuples; outputs preserve literal stock, identity, marker and error expectations. No
 * expected game result is regenerated from production settlement; this owner performs no game, model or
 * transport execution.
 */


export function fixtureNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("fixture_number_invalid");
  return value;
}

export function fixtureObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("fixture_object_invalid");
  return value as Record<string, unknown>;
}
