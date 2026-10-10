import { copyEventData } from "./event-data";
export const MAGICIAN_EVENT_TYPE = "magician_exchange_committed" as const;
export interface MagicianExchangeFact {
  actorId: number;
  day: number;
  pair: [number, number] | null;
}
export interface MagicianOwnExchangeFact {
  day: number;
  pair: [number, number] | null;
}
function positive(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER;
}
function payloadObject(v: unknown): Record<string, unknown> | null {
  try {
    const p = copyEventData(v);
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
function valid(p: Record<string, unknown> | null, own: boolean): boolean {
  if (!p) return false;
  const keys = own ? ["day", "pair"] : ["actorId", "day", "pair"];
  if (
    Object.keys(p).length !== keys.length ||
    !keys.every((k) => Object.hasOwn(p, k)) ||
    !positive(p.day) ||
    (!own && !positive(p.actorId))
  )
    return false;
  return (
    p.pair === null ||
    (Array.isArray(p.pair) &&
      p.pair.length === 2 &&
      Object.keys(p.pair).length === 2 &&
      positive(p.pair[0]) &&
      positive(p.pair[1]) &&
      p.pair[0] < p.pair[1])
  );
}
export function readMagicianExchangeFact(
  type: string,
  payload: unknown,
): MagicianExchangeFact | null {
  if (type !== MAGICIAN_EVENT_TYPE) return null;
  const p = payloadObject(payload);
  return valid(p, false) ? (p as unknown as MagicianExchangeFact) : null;
}
export function readMagicianOwnExchangeFact(
  type: string,
  payload: unknown,
): MagicianOwnExchangeFact | null {
  if (type !== MAGICIAN_EVENT_TYPE) return null;
  const p = payloadObject(payload);
  return valid(p, true) ? (p as unknown as MagicianOwnExchangeFact) : null;
}

export interface DeathShotMissFact {
  actorId: number;
  reason: "no_effect";
}
export function readDeathShotMissFact(type: string, payload: unknown): DeathShotMissFact | null {
  if (type !== "death_shot_missed") return null;
  const p = payloadObject(payload);
  return p &&
    Object.keys(p).length === 2 &&
    Object.hasOwn(p, "actorId") &&
    Object.hasOwn(p, "reason") &&
    positive(p.actorId) &&
    p.reason === "no_effect"
    ? (p as unknown as DeathShotMissFact)
    : null;
}
