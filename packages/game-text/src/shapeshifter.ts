import { copyEventData } from "./event-data";
import type { RoleId } from "@ai-werewolf-arena/game-catalog";
export const SHAPESHIFTER_EVENT_TYPES = [
  "shapeshifter_initial_deal",
  "shapeshifter_identity_chosen",
] as const;
const roles: readonly RoleId[] = [
  "shapeshifter",
  "wolf",
  "villager",
  "seer",
  "witch",
  "hunter",
  "guard",
  "idiot",
];
const policy = "awa_netease_shapeshifter_two_extra_villagers_v1";
function keys(p: Record<string, unknown>, required: string[]) {
  return Object.keys(p).length === required.length && required.every((k) => Object.hasOwn(p, k));
}
export function readShapeshifterEventFact(
  type: string,
  payload: unknown,
): Record<string, unknown> | null {
  if (!(SHAPESHIFTER_EVENT_TYPES as readonly string[]).includes(type)) return null;
  try {
    const p = copyEventData(payload, 130) as Record<string, unknown>;
    if (!p || Array.isArray(p) || p.policy !== policy) return null;
    if (type === "shapeshifter_initial_deal") {
      if (
        !keys(p, ["policy", "roles", "boardSize"]) ||
        !Number.isSafeInteger(p.boardSize) ||
        (p.boardSize as number) < 6 ||
        (p.boardSize as number) > 128 ||
        !Array.isArray(p.roles) ||
        p.roles.length !== (p.boardSize as number) + 2 ||
        !p.roles.every((role) => roles.includes(role as RoleId)) ||
        p.roles.filter((role) => role === "shapeshifter").length !== 1 ||
        p.roles.filter((role) => role === "wolf").length < 2 ||
        p.roles.filter((role) => role !== "wolf" && role !== "shapeshifter").length < 3
      )
        return null;
    } else {
      if (
        !keys(p, ["policy", "actorId", "day", "slot", "role", "camp"]) ||
        !Number.isSafeInteger(p.actorId) ||
        (p.actorId as number) < 1 ||
        p.day !== 1 ||
        !roles.includes(p.role as RoleId) ||
        ![0, 1].includes(p.slot as number) ||
        p.role === "shapeshifter" ||
        p.camp !== (p.role === "wolf" ? "wolf" : "good")
      )
        return null;
    }
    return p;
  } catch {
    return null;
  }
}

/** Shared strict wire tool reader for both the engine and recording layer. */
export function readShapeshifterChoiceTool(
  value: unknown,
): { name: "choose_shapeshifter_card"; args: { slot: 0 | 1 } } | null {
  try {
    const p = copyEventData(value) as Record<string, unknown>;
    if (
      !p ||
      Array.isArray(p) ||
      !keys(p, ["name", "args"]) ||
      p.name !== "choose_shapeshifter_card"
    )
      return null;
    const args = p.args as Record<string, unknown>;
    if (
      !args ||
      Array.isArray(args) ||
      !keys(args, ["slot"]) ||
      (args.slot !== 0 && args.slot !== 1)
    )
      return null;
    return { name: "choose_shapeshifter_card", args: { slot: args.slot } };
  } catch {
    return null;
  }
}
