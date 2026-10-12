/**
 * Owns pure radiant-eclipse facts, knowledge shapes and their inert-data readers.
 * Inputs are original event identifiers and JSON.parse/no-reviver or proven
 * inert payloads; outputs preserve exact copied shapes, null rejection, limits
 * and visibility classifications. These facts never authorize actions or write
 * domain resources/state. Node ingress must reject hostile Proxy objects before
 * shared reflection; this browser-compatible module supplies no runtime handles.
 */
import { copyEventData } from "../inert-event-data";
export const RADIANT_ECLIPSE_EVENT_TYPES = Object.freeze([
  "eclipse_swallowed",
  "eclipse_native_suppressed",
  "eclipse_native_restored",
  "eclipse_lease_closed",
  "radiant_shelter_chosen",
] as const);
export type RadiantEclipseFact =
  | {
      actorId: number;
      day: number;
      targetId: number | null;
      roleId: "villager" | "seer" | "witch" | "dreamer" | "radiant_count" | null;
      abilityId: string | null;
    }
  | { playerId: number; day: number }
  | {
      actorId: number;
      day: number;
      targetId: number | null;
      abilityId: string | null;
      status: "committed" | "aborted";
    }
  | { actorId: number; day: number; targetId: number | null; abilityId: string };
function id(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER;
}
function exact(p: Record<string, unknown>, keys: string[]) {
  return Object.keys(p).length === keys.length && keys.every((k) => Object.hasOwn(p, k));
}
export function readRadiantEclipseFact(type: string, value: unknown): RadiantEclipseFact | null {
  if (!(RADIANT_ECLIPSE_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const copied = copyEventData(value);
    if (!copied || typeof copied !== "object" || Array.isArray(copied)) return null;
    const p = copied as Record<string, unknown>;
    if (!id(p.day)) return null;
    if (type === "eclipse_native_suppressed" || type === "eclipse_native_restored")
      return exact(p, ["playerId", "day"]) && p.day >= 2 && id(p.playerId)
        ? (p as unknown as RadiantEclipseFact)
        : null;
    if (!id(p.actorId) || (p.targetId !== null && !id(p.targetId))) return null;
    if (type === "eclipse_lease_closed")
      return exact(p, ["actorId", "day", "targetId", "abilityId", "status"]) &&
        ["committed", "aborted"].includes(p.status as string) &&
        p.targetId !== p.actorId &&
        (p.targetId !== null || p.abilityId === null) &&
        (p.day !== 1 || (p.targetId === null && p.abilityId === null)) &&
        (p.abilityId === null || p.abilityId === `copy:eclipse:night:${p.day}`)
        ? (p as unknown as RadiantEclipseFact)
        : null;
    if (p.day < 2) return null;
    if (type === "radiant_shelter_chosen")
      return exact(p, ["actorId", "day", "targetId", "abilityId"]) &&
        p.targetId !== p.actorId &&
        (p.abilityId === "native:shelter" || p.abilityId === `copy:eclipse:night:${p.day}`)
        ? (p as unknown as RadiantEclipseFact)
        : null;
    if (!exact(p, ["actorId", "day", "targetId", "roleId", "abilityId"])) return null;
    if (p.targetId === null)
      return p.roleId === null && p.abilityId === null
        ? (p as unknown as RadiantEclipseFact)
        : null;
    return p.targetId !== p.actorId &&
      ["villager", "seer", "witch", "dreamer", "radiant_count"].includes(p.roleId as string) &&
      (p.roleId === "villager"
        ? p.abilityId === null
        : p.abilityId === `copy:eclipse:night:${p.day}`)
      ? (p as unknown as RadiantEclipseFact)
      : null;
  } catch {
    return null;
  }
}
export function radiantEclipseAudience(type: string, fact: RadiantEclipseFact): readonly number[] {
  return type === "eclipse_lease_closed" ? [] : ["playerId" in fact ? fact.playerId : fact.actorId];
}
