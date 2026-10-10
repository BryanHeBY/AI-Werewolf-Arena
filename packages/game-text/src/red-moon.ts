import { copyEventData } from "./event-data";

export const RED_MOON_BLAST_EVENT = "red_moon_night_sealed" as const;
export const RED_MOON_EXILE_EVENT = "red_moon_exile_delayed" as const;
export const RED_MOON_EXPIRY_EVENT = "red_moon_delay_expired" as const;

export interface RedMoonNextNightFact {
  actorId: number;
  day: number;
  night: number;
}
export interface RedMoonExpiryFact {
  actorId: number;
  day: number;
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function record(value: unknown): Record<string, unknown> | null {
  try {
    const copied = copyEventData(value);
    return copied && typeof copied === "object" && !Array.isArray(copied)
      ? (copied as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
function keys(value: Record<string, unknown>, names: string[]): boolean {
  return (
    Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name))
  );
}
export function readRedMoonNextNightFact(
  type: string,
  payload: unknown,
): RedMoonNextNightFact | null {
  if (type !== RED_MOON_BLAST_EVENT && type !== RED_MOON_EXILE_EVENT) return null;
  const p = record(payload);
  return p &&
    keys(p, ["actorId", "day", "night"]) &&
    positive(p.actorId) &&
    positive(p.day) &&
    positive(p.night) &&
    p.night === p.day + 1
    ? (p as unknown as RedMoonNextNightFact)
    : null;
}
export function readRedMoonExpiryFact(type: string, payload: unknown): RedMoonExpiryFact | null {
  if (type !== RED_MOON_EXPIRY_EVENT) return null;
  const p = record(payload);
  return p && keys(p, ["actorId", "day"]) && positive(p.actorId) && positive(p.day)
    ? (p as unknown as RedMoonExpiryFact)
    : null;
}
