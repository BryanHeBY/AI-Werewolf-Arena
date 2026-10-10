import { types } from "node:util";
import type { RoleComponent } from "../../../../core";
export const DEMON_HUNTER_POLICY = "awa_netease_demon_hunter_v1" as const;
export const DEMON_HUNTER_ROLE = "demon_hunter" as const;
export interface DemonHunterChoice {
  day: number;
  targetId: number | null;
}
export interface DemonHunterState {
  policy: typeof DEMON_HUNTER_POLICY;
  history: DemonHunterChoice[];
}
export function ownDemonData(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
/** Inspect only plain own data; original runtime identities are never reconstructed from this copy. */
export function demonSnapshot(
  value: unknown,
  seen = new Set<object>(),
  depth = 0,
  arrayLimit = 256,
): unknown {
  if (
    value === null ||
    ["string", "boolean"].includes(typeof value) ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
  if (!value || typeof value !== "object" || types.isProxy(value) || depth > 16 || seen.has(value))
    throw new Error("demon_hunter_data_invalid");
  const array = Array.isArray(value),
    prototype = Object.getPrototypeOf(value);
  if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null)
    throw new Error("demon_hunter_data_invalid");
  seen.add(value);
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value),
      result: Record<string, unknown> = {};
    if (Reflect.ownKeys(descriptors).some((key) => typeof key !== "string"))
      throw new Error("demon_hunter_data_invalid");
    for (const [key, d] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (!("value" in d) || !d.enumerable) throw new Error("demon_hunter_data_invalid");
      Object.defineProperty(result, key, {
        enumerable: true,
        value: demonSnapshot(d.value, seen, depth + 1, arrayLimit),
      });
    }
    if (!array) return result;
    const length = descriptors.length?.value;
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > arrayLimit ||
      Object.keys(result).length !== length ||
      !Array.from({ length }, (_, i) => Object.hasOwn(result, i)).every(Boolean)
    )
      throw new Error("demon_hunter_data_invalid");
    return Array.from({ length }, (_, i) => result[i]);
  } finally {
    seen.delete(value);
  }
}
export function demonJson(value: unknown): string | null {
  try {
    return JSON.stringify(demonSnapshot(value));
  } catch {
    return null;
  }
}
export function exactDemonData(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export function freshDemonHunterState(): DemonHunterState {
  return { policy: DEMON_HUNTER_POLICY, history: [] };
}
export function readDemonHunterState(value: unknown): DemonHunterState | null {
  try {
    const s = demonSnapshot(value);
    if (
      !exactDemonData(s, ["policy", "history"]) ||
      s.policy !== DEMON_HUNTER_POLICY ||
      !Array.isArray(s.history)
    )
      return null;
    let previous = 1;
    for (const choice of s.history) {
      if (
        !exactDemonData(choice, ["day", "targetId"]) ||
        !Number.isSafeInteger(choice.day) ||
        (choice.day as number) <= previous ||
        (choice.targetId !== null &&
          (!Number.isSafeInteger(choice.targetId) || (choice.targetId as number) < 1))
      )
        return null;
      previous = choice.day as number;
    }
    return s as unknown as DemonHunterState;
  } catch {
    return null;
  }
}
export function getDemonHunterState(role: RoleComponent | undefined): DemonHunterState | undefined {
  const s = ownDemonData(ownDemonData(role, "privateState"), "demonHunter");
  return readDemonHunterState(s) ? (s as DemonHunterState) : undefined;
}
export interface DemonHuntTool {
  name: "demon_hunt";
  args: { target_id: number | null; abstain: boolean };
}
export function readDemonHuntTool(value: unknown): DemonHuntTool | null {
  try {
    const call = demonSnapshot(value);
    if (
      !exactDemonData(call, ["name", "args"]) ||
      call.name !== "demon_hunt" ||
      !exactDemonData(call.args, ["target_id", "abstain"])
    )
      return null;
    const { target_id: target, abstain } = call.args;
    if (
      target === null
        ? abstain !== true
        : !Number.isSafeInteger(target) || (target as number) < 1 || abstain !== false
    )
      return null;
    return call as unknown as DemonHuntTool;
  } catch {
    return null;
  }
}
