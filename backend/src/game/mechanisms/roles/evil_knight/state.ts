import { types } from "node:util";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role, type EntityId } from "../../../../core/domain/identity";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
  type NightRetaliationAttack,
} from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";

export const EVIL_KNIGHT_ROLE = "evil_knight" as const;
export const EVIL_KNIGHT_POLICY = "awa_evil_knight_v1" as const;
export type EvilKnightShotPolicy = "night_shot_immune" | "hunter_shot_bypasses";
export interface EvilKnightState {
  policy: typeof EVIL_KNIGHT_POLICY;
  shotPolicy: EvilKnightShotPolicy;
  reflectionRemaining: 0 | 1;
}
function data(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
export function freshEvilKnightState(
  shotPolicy: EvilKnightShotPolicy = "night_shot_immune",
): EvilKnightState {
  return { policy: EVIL_KNIGHT_POLICY, shotPolicy, reflectionRemaining: 1 };
}
export function getEvilKnightState(role: RoleComponent | undefined): EvilKnightState | undefined {
  if (data(role, "role") !== EVIL_KNIGHT_ROLE || data(role, "camp") !== Camp.Wolf) return undefined;
  const state = data(data(role, "privateState"), "evilKnight");
  const shot = data(state, "shotPolicy"),
    remaining = data(state, "reflectionRemaining");
  return data(state, "policy") === EVIL_KNIGHT_POLICY &&
    (shot === "night_shot_immune" || shot === "hunter_shot_bypasses") &&
    (remaining === 0 || remaining === 1)
    ? (state as EvilKnightState)
    : undefined;
}
/** Capture the original identity before awaiting another player's submission. */
export function captureEvilKnight(world: World, target: NightLifeScope) {
  const role = world.getComponent<RoleComponent>(target.id, COMPONENT.Role);
  const state = getEvilKnightState(role);
  if (!role || !state || !livingNightLife(world, target)) return null;
  const privateState = role.privateState,
    shotPolicy = state.shotPolicy;
  const isCurrent = () =>
    livingNightLife(world, target) &&
    world.getComponent(target.id, COMPONENT.Role) === role &&
    role.privateState === privateState &&
    getEvilKnightState(role) === state &&
    state.shotPolicy === shotPolicy;
  return { target, state, isCurrent };
}
export function evilKnightNightShotImmune(world: World, targetId: EntityId): boolean {
  const life = captureNightLife(world, targetId);
  const binding = life && captureEvilKnight(world, life);
  return !!binding && binding.state.shotPolicy === "night_shot_immune" && binding.isCurrent();
}
/** Call only after an accepted native Seer check or Witch poison has consumed its action. */
export function commitEvilKnightReflection(
  world: World,
  binding: ReturnType<typeof captureEvilKnight>,
  caster: NightLifeScope,
  trigger: "seer_check" | "poison",
  casterCurrent: () => boolean,
): NightRetaliationAttack | null {
  const casterRole = world.getComponent<RoleComponent>(caster.id, COMPONENT.Role);
  const expected = trigger === "seer_check" ? Role.Seer : Role.Witch;
  if (
    !binding ||
    !binding.isCurrent() ||
    binding.state.reflectionRemaining !== 1 ||
    !livingNightLife(world, caster) ||
    !casterCurrent() ||
    casterRole?.role !== expected ||
    casterRole.camp !== Camp.Good
  )
    return null;
  const privateState = casterRole.privateState;
  binding.state.reflectionRemaining = 0;
  return {
    actorId: binding.target.id,
    target: caster,
    isCurrent: () =>
      binding.isCurrent() &&
      binding.state.reflectionRemaining === 0 &&
      livingNightLife(world, caster) &&
      casterCurrent() &&
      world.getComponent(caster.id, COMPONENT.Role) === casterRole &&
      casterRole.role === expected &&
      casterRole.camp === Camp.Good &&
      casterRole.privateState === privateState,
  };
}
