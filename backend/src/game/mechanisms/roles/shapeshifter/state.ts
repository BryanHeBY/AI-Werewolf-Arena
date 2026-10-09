import { Role, type RoleComponent, type World } from "../../../../core/domain";
import { shapeshifterSetupStatus } from "./deal";
export const SHAPESHIFTER_POLICY = "awa_netease_shapeshifter_two_extra_villagers_v1" as const;
export interface ShapeshifterState {
  policy: typeof SHAPESHIFTER_POLICY;
  remaining: 0 | 1;
  choice: 0 | 1 | null;
}
import { dataField } from "../thief/state";
export function getShapeshifterState(role: RoleComponent | undefined): ShapeshifterState | null {
  if (!role || dataField(role, "role") !== Role.Shapeshifter) return null;
  const state = dataField(dataField(role, "privateState"), "shapeshifter");
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
  return policy === SHAPESHIFTER_POLICY &&
    (remaining === 0 || remaining === 1) &&
    (choice === null || choice === 0 || choice === 1)
    ? (state as ShapeshifterState)
    : null;
}
export function projectShapeshifterState(
  role: RoleComponent | undefined,
  world: World,
): ShapeshifterState | undefined {
  const s = getShapeshifterState(role);
  if (!s) return;
  return {
    policy: s.policy,
    remaining: shapeshifterSetupStatus(world) === "pending" ? s.remaining : 0,
    choice: s.choice,
  };
}
export function readShapeshifterChoice(value: unknown): 0 | 1 | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 1 || keys[0] !== "slot") return;
  const slot = dataField(value, "slot");
  return slot === 0 || slot === 1 ? slot : undefined;
}

export { readShapeshifterChoiceTool as readShapeshifterTool } from "@ai-werewolf-arena/game-text";
