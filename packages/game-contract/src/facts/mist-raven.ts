/**
 * Owns pure mist-raven facts, knowledge shapes and their inert-data readers.
 * Inputs are original event identifiers and JSON.parse/no-reviver or proven
 * inert payloads; outputs preserve exact copied shapes, null rejection, limits
 * and visibility classifications. These facts never authorize actions or write
 * domain resources/state. Node ingress must reject hostile Proxy objects before
 * shared reflection; this browser-compatible module supplies no runtime handles.
 */
import { copyEventData } from "../inert-event-data";

export const MIST_RAVEN_EVENT_TYPES = Object.freeze([
  "alchemist_mist_chosen",
  "alchemist_mist_skipped",
  "alchemist_snake_chosen",
  "raven_unsealed",
  "raven_knife_chosen",
  "raven_knife_skipped",
  "mist_knife_drawn",
] as const);
export type MistRavenEventType = (typeof MIST_RAVEN_EVENT_TYPES)[number];
export type MistRavenFact =
  | { actorId: number; day: number; targetIds: number[] | null }
  | { actorId: number; day: number; targetId: number | null }
  | { actorId: number; day: number; reason: "dead" | "spent" | "no_targets" | "sealed" }
  | { actorId: number; day: number; awakened: true; knownTeammateIds: number[] }
  | { day: number; candidates: number[]; targetId: number | null };
function id(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < Number.MAX_SAFE_INTEGER;
}
function ids(v: unknown): v is number[] {
  return Array.isArray(v) && v.every(id) && new Set(v).size === v.length;
}
function exact(p: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(p).length === keys.length && keys.every((k) => Object.hasOwn(p, k));
}
/** A detached JSON fact reader shared by player projection, recording and replay. */
export function readMistRavenFact(type: string, value: unknown): MistRavenFact | null {
  if (!(MIST_RAVEN_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const copied = copyEventData(value);
    if (!copied || typeof copied !== "object" || Array.isArray(copied)) return null;
    const p = copied as Record<string, unknown>;
    if (!id(p.day)) return null;
    if (type === "mist_knife_drawn") {
      return exact(p, ["day", "candidates", "targetId"]) &&
        ids(p.candidates) &&
        p.candidates.length <= 3 &&
        (p.candidates.length
          ? id(p.targetId) && p.candidates.includes(p.targetId)
          : p.targetId === null)
        ? (p as unknown as MistRavenFact)
        : null;
    }
    if (!id(p.actorId)) return null;
    if (type === "alchemist_mist_chosen")
      return exact(p, ["actorId", "day", "targetIds"]) &&
        (p.targetIds === null || (ids(p.targetIds) && p.targetIds.length === 3))
        ? (p as unknown as MistRavenFact)
        : null;
    if (type === "alchemist_snake_chosen" || type === "raven_knife_chosen")
      return exact(p, ["actorId", "day", "targetId"]) &&
        (p.targetId === null || id(p.targetId)) &&
        (type !== "raven_knife_chosen" || p.targetId !== p.actorId) &&
        (type !== "alchemist_snake_chosen" || p.targetId !== p.actorId || p.day === 1)
        ? (p as unknown as MistRavenFact)
        : null;
    if (type === "raven_unsealed")
      return exact(p, ["actorId", "day", "awakened", "knownTeammateIds"]) &&
        p.awakened === true &&
        ids(p.knownTeammateIds) &&
        p.knownTeammateIds.length <= 1 &&
        !p.knownTeammateIds.includes(p.actorId)
        ? (p as unknown as MistRavenFact)
        : null;
    return exact(p, ["actorId", "day", "reason"]) &&
      [
        "dead",
        "spent",
        "no_targets",
        ...(type === "raven_knife_skipped" ? ["sealed"] : []),
      ].includes(p.reason as string)
      ? (p as unknown as MistRavenFact)
      : null;
  } catch {
    return null;
  }
}
