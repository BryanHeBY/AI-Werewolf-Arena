import { Role, type RoleComponent, type World } from "../../../../core/domain";
import { thiefSetupStatus } from "./deal";
export const THIEF_POLICY = "lui_meme_thief_two_extra_villagers_v1" as const;
export interface ThiefState {
  policy: typeof THIEF_POLICY;
  remaining: 0 | 1;
  choice: 0 | 1 | null;
}
export function dataField(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}
export function getThiefState(role: RoleComponent | undefined): ThiefState | null {
  if (!role || dataField(role, "role") !== Role.Thief) return null;
  const state = dataField(dataField(role, "privateState"), "thief");
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const keys = Reflect.ownKeys(state);
  if (
    keys.length !== 3 ||
    !keys.every((key) => ["policy", "remaining", "choice"].includes(String(key)))
  )
    return null;
  const policy = dataField(state, "policy"),
    remaining = dataField(state, "remaining"),
    choice = dataField(state, "choice");
  return policy === THIEF_POLICY &&
    (remaining === 0 || remaining === 1) &&
    (choice === null || choice === 0 || choice === 1)
    ? (state as ThiefState)
    : null;
}
export function projectThiefState(
  role: RoleComponent | undefined,
  world: World,
): ThiefState | undefined {
  const s = getThiefState(role);
  if (!s) return;
  return {
    policy: s.policy,
    remaining: thiefSetupStatus(world) === "pending" ? s.remaining : 0,
    choice: s.choice,
  };
}
export function readThiefChoice(value: unknown): 0 | 1 | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== "slot") return;
  const slot = dataField(value, "slot");
  return slot === 0 || slot === 1 ? slot : undefined;
}

export function readThiefTool(
  value: unknown,
): import("../../../../core/domain").TypedToolCall<"choose_thief_card"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 2 ||
    !keys.includes("name") ||
    !keys.includes("args") ||
    dataField(value, "name") !== "choose_thief_card"
  )
    return null;
  const slot = readThiefChoice(dataField(value, "args"));
  return slot === undefined ? null : { name: "choose_thief_card", args: { slot } };
}
