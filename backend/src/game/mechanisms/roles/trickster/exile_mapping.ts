import { types } from "node:util";
export type ExchangePair = readonly [number, number];
function normalized(pair: ExchangePair | null): [number, number] | null {
  if (pair === null) return null;
  if (types.isProxy(pair) || !Array.isArray(pair)) throw new Error("trickster_pair_invalid");
  const d = Object.getOwnPropertyDescriptors(pair as object);
  const a = d["0"]?.value,
    b = d["1"]?.value;
  if (
    Reflect.ownKeys(d).length !== 3 ||
    d.length?.value !== 2 ||
    !Number.isSafeInteger(a) ||
    !Number.isSafeInteger(b) ||
    a <= 0 ||
    b <= 0 ||
    a >= Number.MAX_SAFE_INTEGER ||
    b >= Number.MAX_SAFE_INTEGER ||
    a === b
  )
    throw new Error("trickster_pair_invalid");
  return a < b ? [a, b] : [b, a];
}
export function matchingExchangePairs(a: ExchangePair | null, b: ExchangePair | null): boolean {
  const x = normalized(a),
    y = normalized(b);
  return !!x && !!y && x[0] === y[0] && x[1] === y[1];
}
/** Only final exile output is mapped; this never edits identities, seats or ballots. */
export function mapTricksterExileTarget(
  requested: number | null,
  pair: ExchangePair | null,
  magicianPair: ExchangePair | null = null,
): number | null {
  if (
    requested !== null &&
    (!Number.isSafeInteger(requested) || requested <= 0 || requested >= Number.MAX_SAFE_INTEGER)
  )
    throw new Error("trickster_target_invalid");
  const p = normalized(pair),
    cancelled = matchingExchangePairs(p, magicianPair);
  if (requested === null || !p || cancelled) return requested;
  return requested === p[0] ? p[1] : requested === p[1] ? p[0] : requested;
}
