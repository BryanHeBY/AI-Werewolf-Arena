/**
 * Owns pure Lonely Girl choice, optional camp and tool contracts for wire consumers.
 * Inputs are identifiers and proven inert payload data; outputs are detached
 * shapes or null with original keys, limits, defaults and scalar correlations.
 * For these inputs the reader never changes rules, resources, phases or action
 * authority. Proxy reflection safety belongs to Node ingress before calling;
 * browser consumers must supply inert data rather than arbitrary JS objects.
 */
import { copyEventData } from "../inert-event-data";
export const LONELY_GIRL_POLICY = "awa_netease_lonely_girl_v1" as const;
export const LONELY_GIRL_EVENT_TYPES = ["lonely_girl_admired_chosen"] as const;
export interface LonelyGirlChoiceFact {
  policy: typeof LONELY_GIRL_POLICY;
  actorId: number;
  day: 1;
  targetId: number;
  camp?: "good" | "wolf";
}
function keys(p: Record<string, unknown>, names: string[]) {
  return Object.keys(p).length === names.length && names.every((k) => Object.hasOwn(p, k));
}
export function readLonelyGirlEventFact(
  type: string,
  payload: unknown,
): LonelyGirlChoiceFact | null {
  if (type !== "lonely_girl_admired_chosen") return null;
  try {
    const p = copyEventData(payload) as Record<string, unknown>;
    if (
      !p ||
      Array.isArray(p) ||
      !keys(
        p,
        Object.hasOwn(p, "camp")
          ? ["policy", "actorId", "day", "targetId", "camp"]
          : ["policy", "actorId", "day", "targetId"],
      ) ||
      p.policy !== LONELY_GIRL_POLICY ||
      p.day !== 1 ||
      !Number.isSafeInteger(p.actorId) ||
      (p.actorId as number) < 1 ||
      !Number.isSafeInteger(p.targetId) ||
      (p.targetId as number) < 1 ||
      p.actorId === p.targetId ||
      (Object.hasOwn(p, "camp") && p.camp !== "good" && p.camp !== "wolf")
    )
      return null;
    return p as unknown as LonelyGirlChoiceFact;
  } catch {
    return null;
  }
}
export function readLonelyGirlChoiceTool(
  value: unknown,
): { name: "choose_admired_player"; args: { target_id: number } } | null {
  try {
    const p = copyEventData(value) as Record<string, unknown>,
      a = p?.args as Record<string, unknown>;
    return p &&
      !Array.isArray(p) &&
      keys(p, ["name", "args"]) &&
      p.name === "choose_admired_player" &&
      a &&
      !Array.isArray(a) &&
      keys(a, ["target_id"]) &&
      Number.isSafeInteger(a.target_id) &&
      (a.target_id as number) > 0
      ? { name: "choose_admired_player", args: { target_id: a.target_id as number } }
      : null;
  } catch {
    return null;
  }
}
