/**
 * Owns pure Thief initial deal and chosen identity contracts for wire consumers.
 * Inputs are identifiers and proven inert payload data; outputs are detached
 * shapes or null with original keys, limits, defaults and scalar correlations.
 * For these inputs the reader never changes rules, resources, phases or action
 * authority. Proxy reflection safety belongs to Node ingress before calling;
 * browser consumers must supply inert data rather than arbitrary JS objects.
 */
import { copyEventData } from "../inert-event-data";
import type { RoleId } from "../role-ids";
export const THIEF_EVENT_TYPES = ["thief_initial_deal", "thief_identity_chosen"] as const;
const roles: readonly RoleId[] = [
  "thief",
  "wolf",
  "villager",
  "seer",
  "witch",
  "hunter",
  "guard",
  "idiot",
];
const policy = "lui_meme_thief_two_extra_villagers_v1";
function keys(p: Record<string, unknown>, required: string[]) {
  return Object.keys(p).length === required.length && required.every((k) => Object.hasOwn(p, k));
}
export function readThiefEventFact(type: string, payload: unknown): Record<string, unknown> | null {
  if (!(THIEF_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(payload, 130) as Record<string, unknown>;
    if (!p || Array.isArray(p) || p.policy !== policy) return null;
    if (type === "thief_initial_deal") {
      if (
        !keys(p, ["policy", "roles", "boardSize"]) ||
        !Number.isSafeInteger(p.boardSize) ||
        (p.boardSize as number) < 3 ||
        (p.boardSize as number) > 128 ||
        !Array.isArray(p.roles) ||
        p.roles.length !== (p.boardSize as number) + 2 ||
        !p.roles.every((role) => roles.includes(role as RoleId)) ||
        p.roles.filter((role) => role === "thief").length !== 1 ||
        p.roles.filter((role) => role === "wolf").length < 2 ||
        p.roles.filter((role) => role !== "wolf" && role !== "thief").length < 4
      )
        return null;
    } else {
      if (
        !keys(p, ["policy", "actorId", "day", "slot", "role", "camp"]) ||
        !Number.isSafeInteger(p.actorId) ||
        (p.actorId as number) < 1 ||
        p.day !== 1 ||
        !roles.includes(p.role as RoleId) ||
        ![0, 1, null].includes(p.slot as number | null) ||
        (p.slot === null) !== (p.role === "thief") ||
        p.camp !== (p.role === "wolf" ? "wolf" : "good")
      )
        return null;
    }
    return p;
  } catch {
    return null;
  }
}
