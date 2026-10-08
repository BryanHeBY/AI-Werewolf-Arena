import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import type { World } from "../../../core/domain/world";
import type { EntityId } from "../../../core/domain/model";
import { activeNightAbility, type NightAbility, type NightAbilityKind } from "./abilities";

/** Capture before requesting an action; eligibility is read-only and rechecked at commitment. */
export function captureNightAbilityScope<K extends NightAbilityKind>(world: World, actorId: EntityId, ability: NightAbility<K>, day: number, phaseCurrent: () => boolean) {
  const role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role), life = captureNightLife(world, actorId);
  if (!role || !life) return null;
  const roleKind = role.role, camp = role.camp, privateState = role.privateState;
  const state = ability.state, kind = ability.kind, activation = ability.activation, id = ability.id;
  return {
    role, life, state,
    isEligible: () => phaseCurrent() && world.getComponent(actorId, COMPONENT.Role) === role &&
      role.role === roleKind && role.camp === camp && role.privateState === privateState && livingNightLife(world, life) &&
      ability.id === id && ability.kind === kind && ability.activation === activation && ability.state === state &&
      activeNightAbility(role, kind, day, id) === ability,
  };
}
