import { types } from "node:util";
export type SeatExchangePair = readonly [number, number];
function positive(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}
function copyPair(value: SeatExchangePair | null): SeatExchangePair | null {
  if (value === null) return null;
  if (types.isProxy(value) || !Array.isArray(value))
    throw new Error("wolf_sorcerer_mapping_invalid");
  const d: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(value as object);
  const a = d["0"],
    b = d["1"],
    length = d["length"];
  if (
    Reflect.ownKeys(d).length !== 3 ||
    !a ||
    !("value" in a) ||
    !b ||
    !("value" in b) ||
    !length ||
    !("value" in length) ||
    length.value !== 2 ||
    !positive(a.value) ||
    !positive(b.value) ||
    a.value === b.value
  )
    throw new Error("wolf_sorcerer_mapping_invalid");
  return [a.value, b.value];
}
function swap(id: number, pair: SeatExchangePair | null): number {
  return pair ? (id === pair[0] ? pair[1] : id === pair[1] ? pair[0] : id) : id;
}
/** Swap seat occupants in chronological order: M first, W second, hence M(W(requested)). */
export function resolveOrderedSeatTarget(
  requestedId: number,
  magicianPair: SeatExchangePair | null,
  sorcererPair: SeatExchangePair | null,
): number {
  if (!positive(requestedId)) throw new Error("wolf_sorcerer_mapping_invalid");
  const magician = copyPair(magicianPair),
    sorcerer = copyPair(sorcererPair);
  return swap(swap(requestedId, sorcerer), magician);
}
