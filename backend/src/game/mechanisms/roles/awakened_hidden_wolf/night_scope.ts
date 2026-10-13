/**
 * Captures Awakened Hidden Wolf owner, mimic skill and mirror scopes for one real night. Inputs
 * are the original ability and role/life references; outputs are currentness checks and
 * night-commit bookkeeping. It never lets a new state, source or body inherit the old captured
 * permission.
 */
import type {
  AwakenedReadState as AwakenedState,
  AwakenedReadActiveSkill as AwakenedActiveSkill,
} from "@ai-werewolf-arena/game-contract";

import { aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role, type EntityId } from "../../../../core/domain/model";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";
import { awakenedSkillForNight, getAwakenedState } from "./state";
import { findNightAbility, type NightAbilityReadView } from "../abilities";

export interface AwakenedOwnerScope {
  readonly world: World;
  readonly actorId: EntityId;
  readonly role: RoleComponent;
  readonly state: AwakenedState;
  readonly life: NightLifeScope;
  isCurrent(allowFirstDeath?: boolean): boolean;
}
export function captureAwakenedOwner(
  world: World,
  actorId: EntityId,
  phaseCurrent: () => boolean,
): AwakenedOwnerScope | null {
  const role = world.getComponent(actorId, COMPONENT.Role),
    state = getAwakenedState(role),
    life = captureNightLife(world, actorId);
  if (
    !phaseCurrent() ||
    !role ||
    role.role !== Role.AwakenedHiddenWolf ||
    role.camp !== Camp.Wolf ||
    !state ||
    !life
  )
    return null;
  const privateState = role.privateState;
  return {
    world,
    actorId,
    role,
    state,
    life,
    isCurrent: (allowFirstDeath = false) => {
      const original =
        world.getComponent(actorId, COMPONENT.Alive) === life.life &&
        aliveLifeVersion(life.life) ===
          life.version + (allowFirstDeath && !life.life.alive ? 1 : 0);
      return (
        phaseCurrent() &&
        world.getComponent(actorId, COMPONENT.Role) === role &&
        role.role === Role.AwakenedHiddenWolf &&
        role.camp === Camp.Wolf &&
        role.privateState === privateState &&
        getAwakenedState(role) === state &&
        original &&
        (allowFirstDeath || life.life.alive)
      );
    },
  };
}
/** Bind paid facts without reading a closed slot or spent bottle/knife. */
export function bindAwakenedSkill(
  owner: AwakenedOwnerScope,
  day: number,
): { readonly skill: AwakenedActiveSkill; isCurrent(allowFirstDeath?: boolean): boolean } | null {
  const learned = owner.state.learned,
    skill = awakenedSkillForNight(owner.state, day);
  if (
    !owner.isCurrent() ||
    !learned ||
    !skill ||
    learned.activationNight === null ||
    learned.activeFromNight === null
  )
    return null;
  const { targetId, role, day: learnedDay, activationNight, activeFromNight } = learned,
    kind = skill.kind;
  return {
    skill,
    isCurrent: (allowFirstDeath = false) =>
      owner.isCurrent(allowFirstDeath) &&
      owner.state.learned === learned &&
      learned.skill === skill &&
      skill.kind === kind &&
      learned.targetId === targetId &&
      learned.role === role &&
      learned.day === learnedDay &&
      learned.activationNight === activationNight &&
      learned.activeFromNight === activeFromNight,
  };
}
/** Only the Aw-owned native Mirror depends on its learning; independent gifts/copies do not. */
export function captureAwakenedMirrorScope(
  world: World,
  actorId: EntityId,
  ability: NightAbilityReadView<"role_check">,
  day: number,
  phaseCurrent: () => boolean,
): (() => boolean) | null {
  const owner = captureAwakenedOwner(world, actorId, phaseCurrent),
    learned = owner?.state.learned,
    skill = learned?.skill;
  if (
    !owner ||
    currentAwakenedNight(world, owner.role) !== day ||
    !learned ||
    learned.role !== Role.MirrorGirl ||
    learned.activationNight === null ||
    learned.activeFromNight === null ||
    day < learned.activeFromNight ||
    skill?.kind !== "inspection" ||
    skill.abilityId !== ability.id
  )
    return null;
  const { targetId, role, day: learnedDay, activationNight, activeFromNight } = learned,
    abilityId = skill.abilityId;
  return () =>
    owner.isCurrent() &&
    currentAwakenedNight(world, owner.role) === day &&
    owner.state.learned === learned &&
    learned.skill === skill &&
    skill.kind === "inspection" &&
    skill.abilityId === abilityId &&
    learned.targetId === targetId &&
    learned.role === role &&
    learned.day === learnedDay &&
    learned.activationNight === activationNight &&
    learned.activeFromNight === activeFromNight &&
    findNightAbility(owner.role, "role_check", abilityId) === ability;
}
const nights = new WeakMap<
  World,
  { day: number; owners: Map<RoleComponent, AwakenedOwnerScope> }
>();
const committed = new WeakMap<World, Set<number>>();
export function beginAwakenedNight(
  world: World,
  day: number,
  owners: readonly AwakenedOwnerScope[],
): void {
  if (hasAwakenedNightCommit(world, day)) throw new Error("awakened_night_reentry_after_commit");
  if (nights.get(world)?.day === day) throw new Error("awakened_night_reentry_after_commit");
  if ((nights.get(world)?.day ?? day) > day) throw new Error("awakened_night_clock_regressed");
  const currentOwners = owners.filter((owner) => owner.world === world && owner.isCurrent());
  nights.set(world, { day, owners: new Map(currentOwners.map((owner) => [owner.role, owner])) });
  // Establishing this night's original-body authority is itself a committed prefix,
  // including nights with only an inherited base knife or no copied active skill.
  if (currentOwners.length) recordAwakenedNightCommit(world, day);
}
export function currentAwakenedNight(world: World, role: RoleComponent): number | null {
  const night = nights.get(world),
    owner = night?.owners.get(role);
  return night && owner?.isCurrent() && livingNightLife(world, owner.life) ? night.day : null;
}
export function recordAwakenedNightCommit(world: World, day: number): void {
  const days = committed.get(world) ?? new Set<number>();
  days.add(day);
  committed.set(world, days);
}
export function hasAwakenedNightCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}
