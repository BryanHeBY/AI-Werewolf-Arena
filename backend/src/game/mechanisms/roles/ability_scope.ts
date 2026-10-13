/**
 * Captures an ability owner with original role, life, state, source and policy identities.
 * Inputs are the selected instance and phase-current callback; outputs are owner-current and
 * active-eligibility checks. Replacing a captured slot or policy invalidates the scope without
 * writing state or spending a use.
 */
import type { NightAbilityKind } from "@ai-werewolf-arena/game-contract";

import { captureRadiantTurn } from "./radiant_eclipse/night_frame";
import { COMPONENT } from "../../../core/domain/components/names";

import { captureNightLife, livingNightLife } from "../../../core/domain/night_effects";
import type { World } from "../../../core/domain/world";
import type { EntityId } from "../../../core/domain/model";
import { activeNightAbility, type NightAbilityReadView } from "./abilities";
import { aliveLifeVersion } from "../../../core/domain/components/alive";

/** A policy edit is an authorization edit, even if the resource object survives. */
function policyIdentity(ability: NightAbilityReadView): string {
  switch (ability.kind) {
    case "pair_check":
      return JSON.stringify([ability.state.policy]);
    case "shelter":
      return JSON.stringify([ability.state.policy]);
    case "seer_check":
      return JSON.stringify([ability.state.targetPolicy, ability.state.actionPolicy]);
    case "potion":
      return JSON.stringify([
        ability.state.selfHealRule,
        ability.state.knifeVisibility,
        ability.state.potionPolicy,
      ]);
    case "guard":
      return JSON.stringify([ability.state.repeatPolicy]);
    case "role_check":
      return JSON.stringify([ability.state.policy, ability.state.inspectionPolicy]);
    case "dream":
      return JSON.stringify([ability.state.protectionPolicy]);
  }
}

/** Capture before requesting an action; eligibility is read-only and rechecked at commitment. */
export function captureNightAbilityScope<K extends NightAbilityKind>(
  world: World,
  actorId: EntityId,
  ability: NightAbilityReadView<K>,
  day: number,
  phaseCurrent: () => boolean,
) {
  const role = world.getComponent(actorId, COMPONENT.Role),
    life = captureNightLife(world, actorId);
  if (!role || !life) return null;
  const radiantCurrent = captureRadiantTurn(world, actorId, ability, day);
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
  const policy = policyIdentity(ability);
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
    policyIdentity(ability) === policy &&
    (role.privateState.abilities as Readonly<Record<string, NightAbilityReadView>> | undefined)?.[
      id
    ] === ability &&
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
    isEligible: () =>
      radiantCurrent() && ownerCurrent() && activeNightAbility(role, kind, day, id) === ability,
  };
}
