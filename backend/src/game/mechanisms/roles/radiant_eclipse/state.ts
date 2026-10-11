import { types } from "node:util";

export const RADIANT_ECLIPSE_POLICY = "awa_radiant_eclipse_v1" as const;
export interface ShelterState {
  policy: typeof RADIANT_ECLIPSE_POLICY;
  lastTarget: number | null;
  lastDay: number | null;
}
const goodRoles = ["villager", "seer", "witch", "dreamer", "radiant_count"] as const;
export type EclipseSwallowedRole = (typeof goodRoles)[number];
export interface EclipseState {
  policy: typeof RADIANT_ECLIPSE_POLICY;
  history: Array<{
    day: number;
    targetId: number | null;
    roleId: EclipseSwallowedRole | null;
    abilityId: string | null;
  }>;
}
function record(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || types.isProxy(value) || Array.isArray(value)) return;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return;
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== keys.length) return;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const field = fields[key];
    if (!field || !("value" in field)) return;
    out[key] = field.value;
  }
  return out;
}
function items(value: unknown): unknown[] | undefined {
  if (types.isProxy(value) || !Array.isArray(value)) return;
  const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
    value as object,
  );
  const length: unknown = fields.length?.value;
  if (
    typeof length !== "number" ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    Reflect.ownKeys(fields).length !== length + 1
  )
    return;
  const out: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const field = fields[String(index)];
    if (!field || !("value" in field)) return;
    out.push(field.value);
  }
  return out;
}
function positive(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < Number.MAX_SAFE_INTEGER
  );
}
export const createShelterState = (): ShelterState => ({
  policy: RADIANT_ECLIPSE_POLICY,
  lastTarget: null,
  lastDay: null,
});
export const createEclipseState = (): EclipseState => ({
  policy: RADIANT_ECLIPSE_POLICY,
  history: [],
});
export function readShelterState(value: unknown): ShelterState | undefined {
  const current = record(value, ["policy", "lastTarget", "lastDay"]);
  if (
    !current ||
    current.policy !== RADIANT_ECLIPSE_POLICY ||
    (current.lastTarget !== null && !positive(current.lastTarget)) ||
    (current.lastDay !== null && (!positive(current.lastDay) || current.lastDay < 2)) ||
    (current.lastDay === null && current.lastTarget !== null)
  )
    return;
  return {
    policy: RADIANT_ECLIPSE_POLICY,
    lastTarget: current.lastTarget as number | null,
    lastDay: current.lastDay as number | null,
  };
}
export function selectShelter(
  state: ShelterState,
  day: number,
  targetId: unknown,
  actorId: number,
  livingIds: readonly number[],
): ShelterState {
  const current = readShelterState(state);
  if (!current || !positive(day) || day < 2 || (current.lastDay !== null && day <= current.lastDay))
    throw new Error("radiant_shelter_unavailable");
  if (
    targetId !== null &&
    (!positive(targetId) ||
      targetId === actorId ||
      !livingIds.includes(targetId) ||
      (current.lastDay === day - 1 && current.lastTarget === targetId))
  )
    throw new Error("radiant_shelter_target");
  return {
    policy: RADIANT_ECLIPSE_POLICY,
    lastTarget: targetId as number | null,
    lastDay: day,
  };
}
export function readEclipseState(value: unknown): EclipseState | undefined {
  const current = record(value, ["policy", "history"]);
  if (!current || current.policy !== RADIANT_ECLIPSE_POLICY) return;
  const entries = items(current.history);
  if (!entries) return;
  const history: EclipseState["history"] = [];
  let previous: EclipseState["history"][number] | undefined;
  for (const entry of entries) {
    const choice = record(entry, ["day", "targetId", "roleId", "abilityId"]);
    if (
      !choice ||
      !positive(choice.day) ||
      choice.day < 2 ||
      (previous && choice.day <= previous.day) ||
      (choice.targetId !== null && !positive(choice.targetId))
    )
      return;
    if (choice.targetId === null) {
      if (choice.roleId !== null || choice.abilityId !== null) return;
    } else {
      if (!(goodRoles as readonly unknown[]).includes(choice.roleId)) return;
      if (
        choice.roleId === "villager"
          ? choice.abilityId !== null
          : choice.abilityId !== `copy:eclipse:night:${choice.day}`
      )
        return;
      if (previous?.day === choice.day - 1 && previous.targetId === choice.targetId) return;
    }
    previous = {
      day: choice.day,
      targetId: choice.targetId as number | null,
      roleId: choice.roleId as EclipseSwallowedRole | null,
      abilityId: choice.abilityId as string | null,
    };
    history.push(previous);
  }
  return { policy: RADIANT_ECLIPSE_POLICY, history };
}
export function selectEclipse(
  state: EclipseState,
  day: number,
  targetId: unknown,
  goodIds: readonly number[],
  roleId: unknown,
): EclipseState {
  const current = readEclipseState(state),
    last = current?.history.at(-1);
  if (!current || !positive(day) || day < 2 || (last && day <= last.day))
    throw new Error("eclipse_swallow_unavailable");
  if (targetId === null) {
    if (roleId !== null) throw new Error("eclipse_swallow_target");
  } else if (
    !positive(targetId) ||
    !goodIds.includes(targetId) ||
    !(goodRoles as readonly unknown[]).includes(roleId) ||
    (last?.day === day - 1 && last.targetId === targetId)
  )
    throw new Error("eclipse_swallow_target");
  return {
    policy: RADIANT_ECLIPSE_POLICY,
    history: [
      ...current.history,
      {
        day,
        targetId: targetId as number | null,
        roleId: roleId as EclipseSwallowedRole | null,
        abilityId: targetId === null || roleId === "villager" ? null : `copy:eclipse:night:${day}`,
      },
    ],
  };
}
