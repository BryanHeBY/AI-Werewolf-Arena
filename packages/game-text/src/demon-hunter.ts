import { copyEventData } from "./event-data";
export const DEMON_HUNTER_POLICY = "awa_netease_demon_hunter_v1" as const;
export const DEMON_HUNTER_EVENT_TYPES = [
  "demon_hunter_chosen",
  "demon_hunter_cancelled",
  "demon_hunter_poison_immune",
] as const;
export interface DemonHunterChoiceFact {
  policy: typeof DEMON_HUNTER_POLICY;
  actorId: number;
  day: number;
  targetId: number | null;
}
export interface DemonHunterPlayerFact {
  policy: typeof DEMON_HUNTER_POLICY;
  day: number;
  targetId: number | null;
}
export interface DemonHunterCancelFact {
  policy: typeof DEMON_HUNTER_POLICY;
  actorId: number;
  day: number;
  targetId: number;
  reason: "authority_revoked";
  faultId: string | null;
}
export interface DemonHunterPoisonImmuneFact {
  policy: typeof DEMON_HUNTER_POLICY;
  actorId: number;
  day: number;
  witchId: number;
}
export type DemonHunterEventFact =
  DemonHunterChoiceFact | DemonHunterCancelFact | DemonHunterPoisonImmuneFact;
function keys(p: Record<string, unknown>, names: readonly string[]): boolean {
  return Object.keys(p).length === names.length && names.every((key) => Object.hasOwn(p, key));
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function data(payload: unknown): Record<string, unknown> | null {
  try {
    const p = copyEventData(payload);
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
export function readDemonHunterEventFact(
  type: string,
  payload: unknown,
): DemonHunterEventFact | null {
  const p = data(payload);
  if (!p || p.policy !== DEMON_HUNTER_POLICY || !positive(p.actorId) || !positive(p.day))
    return null;
  if (type === "demon_hunter_poison_immune")
    return keys(p, ["policy", "actorId", "day", "witchId"]) &&
      positive(p.witchId) &&
      p.witchId !== p.actorId
      ? (p as unknown as DemonHunterPoisonImmuneFact)
      : null;
  if ((p.day as number) < 2) return null;
  if (type === "demon_hunter_chosen")
    return keys(p, ["policy", "actorId", "day", "targetId"]) &&
      (p.targetId === null || (positive(p.targetId) && p.targetId !== p.actorId))
      ? (p as unknown as DemonHunterChoiceFact)
      : null;
  if (type === "demon_hunter_cancelled")
    return keys(p, ["policy", "actorId", "day", "targetId", "reason", "faultId"]) &&
      positive(p.targetId) &&
      p.targetId !== p.actorId &&
      p.reason === "authority_revoked" &&
      (p.faultId === null ||
        (typeof p.faultId === "string" && p.faultId.length > 0 && p.faultId.length <= 128))
      ? (p as unknown as DemonHunterCancelFact)
      : null;
  return null;
}
/** Own choice only: no source, immune result, cancellation, actor identity or target camp. */
export function readDemonHunterPlayerFact(
  type: string,
  payload: unknown,
): DemonHunterPlayerFact | null {
  const p = data(payload);
  return type === "demon_hunter_chosen" &&
    !!p &&
    keys(p, ["policy", "day", "targetId"]) &&
    p.policy === DEMON_HUNTER_POLICY &&
    positive(p.day) &&
    p.day >= 2 &&
    (p.targetId === null || positive(p.targetId))
    ? (p as unknown as DemonHunterPlayerFact)
    : null;
}
