import { COMPONENT } from "../../../core/domain/components/names";
import type { RoleComponent } from "../../../core/domain/components/role";
import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import type { World } from "../../../core/domain/world";
import type { EntityId } from "../../../core/domain/model";
import { activeNightAbility, type NightAbility, type NightAbilityKind } from "./abilities";
import { aliveLifeVersion } from "../../../core/domain/components/alive";

/** Capture before requesting an action; eligibility is read-only and rechecked at commitment. */
export function captureNightAbilityScope<K extends NightAbilityKind>(
  world: World,
  actorId: EntityId,
  ability: NightAbility<K>,
  day: number,
  phaseCurrent: () => boolean,
) {
  const role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role),
    life = captureNightLife(world, actorId);
  if (!role || !life) return null;
  const roleKind = role.role,
    camp = role.camp,
    privateState = role.privateState;
  const state = ability.state,
    kind = ability.kind,
    activation = ability.activation,
    id = ability.id;
  const source = ability.source,
    sourceKind = source.kind,
    sourceOwner = source.kind === "native" ? source.role : source.actorId,
    sourceId = source.kind === "copy" || source.kind === "transfer" ? source.abilityId : undefined;
  const starts = ability.startsOnDay,
    expires = ability.expiresAfterDay,
    maxUses = ability.maxUses,
    disclosed = ability.sourceDisclosed;
  const ownerCurrent = (allowFirstDeath = false) =>
    phaseCurrent() &&
    world.getComponent(actorId, COMPONENT.Role) === role &&
    role.role === roleKind &&
    role.camp === camp &&
    role.privateState === privateState &&
    (livingNightLife(world, life) ||
      (allowFirstDeath &&
        world.getComponent(actorId, COMPONENT.Alive) === life.life &&
        !life.life.alive &&
        aliveLifeVersion(life.life) === life.version + 1)) &&
    ability.id === id &&
    ability.kind === kind &&
    ability.activation === activation &&
    ability.state === state &&
    (role.privateState.abilities as Record<string, NightAbility> | undefined)?.[id] === ability &&
    ability.source === source &&
    source.kind === sourceKind &&
    (source.kind === "native" ? source.role : source.actorId) === sourceOwner &&
    (source.kind === "copy" || source.kind === "transfer" ? source.abilityId : undefined) ===
      sourceId &&
    ability.startsOnDay === starts &&
    ability.expiresAfterDay === expires &&
    ability.maxUses === maxUses &&
    ability.sourceDisclosed === disclosed;
  return {
    role,
    life,
    state,
    isOwnerCurrent: ownerCurrent,
    isEligible: () => ownerCurrent() && activeNightAbility(role, kind, day, id) === ability,
  };
}
