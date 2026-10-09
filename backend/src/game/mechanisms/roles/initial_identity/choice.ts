import { Role, type RoleComponent, type ToolCall } from "../../../../core/domain";
import { getThiefState, readThiefTool } from "../thief/state";
import { getShapeshifterState, readShapeshifterTool } from "../shapeshifter/state";
import {
  INITIAL_IDENTITY_POLICIES,
  type InitialIdentityKind,
  type InitialIdentitySlot,
} from "./deal";
export type InitialIdentityState =
  | NonNullable<ReturnType<typeof getThiefState>>
  | NonNullable<ReturnType<typeof getShapeshifterState>>;
export const initialIdentityPolicy = (kind: InitialIdentityKind) => INITIAL_IDENTITY_POLICIES[kind];
export const initialIdentityRole = (kind: InitialIdentityKind) =>
  kind === "thief" ? Role.Thief : Role.Shapeshifter;
export const initialIdentityTool = (kind: InitialIdentityKind) =>
  kind === "thief" ? ("choose_thief_card" as const) : ("choose_shapeshifter_card" as const);
export const getInitialIdentityState = (
  role: RoleComponent | undefined,
  kind: InitialIdentityKind,
): InitialIdentityState | null =>
  kind === "thief" ? getThiefState(role) : getShapeshifterState(role);
export const readInitialIdentityTool = (call: ToolCall, kind: InitialIdentityKind) =>
  kind === "thief" ? readThiefTool(call) : readShapeshifterTool(call);
export function initialIdentityChoiceRule(
  kind: InitialIdentityKind,
  roles: readonly Role[],
): { mustChoose: boolean; allowedSlots: readonly InitialIdentitySlot[] } {
  const wolfSlots = roles.flatMap((role, slot) =>
    role === Role.Wolf ? [slot as InitialIdentitySlot] : [],
  );
  return Object.freeze({
    mustChoose: kind === "shapeshifter" || wolfSlots.length === 2,
    allowedSlots: Object.freeze(
      kind === "shapeshifter" && wolfSlots.length ? wolfSlots : ([0, 1] as InitialIdentitySlot[]),
    ),
  });
}
