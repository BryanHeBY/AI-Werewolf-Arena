/**
 * Captures Mechanical Wolf owner, copied-skill and selected-mode scopes. Inputs are original
 * life, state and source identities; outputs are current mode checks and real-night commitment
 * records. It never lets replacement mode/state reuse the old mimic or knife permission.
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role, type EntityId } from "../../../../core/domain/model";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";
import {
  getMechanicalState,
  type MechanicalMode,
  type MechanicalState,
  type MechanicalSkill,
} from "./state";

export interface MechanicalOwnerScope {
  readonly world: World;
  readonly actorId: EntityId;
  readonly role: RoleComponent;
  readonly state: MechanicalState;
  readonly life: NightLifeScope;
  isCurrent(): boolean;
}

/** Runtime-only references; never serialized into player state, DTOs or the Tape. */
export function captureMechanicalOwner(
  world: World,
  actorId: EntityId,
  phaseCurrent: () => boolean,
): MechanicalOwnerScope | null {
  const role = world.getComponent(actorId, COMPONENT.Role);
  const state = getMechanicalState(role);
  const life = captureNightLife(world, actorId);
  if (
    !phaseCurrent() ||
    !role ||
    role.role !== Role.MechanicalWolf ||
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
    isCurrent: () =>
      phaseCurrent() &&
      world.getComponent(actorId, COMPONENT.Role) === role &&
      role.role === Role.MechanicalWolf &&
      role.camp === Camp.Wolf &&
      role.privateState === privateState &&
      getMechanicalState(role) === state &&
      livingNightLife(world, life),
  };
}

/** Bind a committed active effect to the exact learning and chosen mode, not resource counters. */
export function bindMechanicalSkill(
  scope: MechanicalOwnerScope,
  day: number,
): {
  readonly skill: MechanicalSkill;
  isCurrent(): boolean;
} | null {
  const learned = scope.state.learned,
    mode = scope.state.mode;
  if (
    day < 2 ||
    !scope.isCurrent() ||
    !hasCurrentMechanicalMode(scope.world, scope.role, "skill") ||
    !learned ||
    learned.readyOnNight > day ||
    !mode ||
    mode.day !== day ||
    mode.kind !== "skill"
  )
    return null;
  const skill = learned.skill,
    kind = skill.kind;
  return {
    skill,
    isCurrent: () =>
      scope.isCurrent() &&
      hasCurrentMechanicalMode(scope.world, scope.role, "skill") &&
      scope.state.learned === learned &&
      learned.skill === skill &&
      skill.kind === kind &&
      scope.state.mode === mode &&
      mode.day === day &&
      mode.kind === "skill" &&
      learned.readyOnNight <= day,
  };
}

interface MechanicalModeScope {
  readonly owner: MechanicalOwnerScope;
  readonly mode: NonNullable<MechanicalState["mode"]>;
  readonly kind: MechanicalMode;
}
const modes = new WeakMap<
  World,
  { readonly day: number; readonly actors: Map<EntityId, MechanicalModeScope> }
>();
const committed = new WeakMap<World, Set<number>>();
export function hasMechanicalNightCommit(world: World, day: number): boolean {
  return committed.get(world)?.has(day) ?? false;
}
export function recordMechanicalNightCommit(world: World, day: number): void {
  const days = committed.get(world) ?? new Set<number>();
  days.add(day);
  committed.set(world, days);
}

/** Save authority only after an accepted mode choice or its explicit skill-mode default. */
export function recordMechanicalModeScope(
  world: World,
  scope: MechanicalOwnerScope,
  day: number,
): boolean {
  const mode = scope.state.mode;
  if (scope.world !== world || day < 2 || !scope.isCurrent() || !mode || mode.day !== day)
    return false;
  let night = modes.get(world);
  if (night && night.day > day) return false;
  if (!night || night.day !== day) {
    night = { day, actors: new Map() };
    modes.set(world, night);
  }
  if (night.actors.has(scope.actorId)) return false;
  night.actors.set(scope.actorId, { owner: scope, mode, kind: mode.kind });
  return true;
}

/** Read-only knife authorization; serialized mode facts alone do not restore old authority. */
export function hasCurrentMechanicalMode(
  world: World,
  role: RoleComponent,
  expectedKind: MechanicalMode,
): boolean {
  const night = modes.get(world);
  if (!night) return false;
  for (const { owner, mode, kind } of night.actors.values()) {
    if (
      owner.role === role &&
      owner.isCurrent() &&
      owner.state.mode === mode &&
      mode.day === night.day &&
      mode.kind === kind &&
      kind === expectedKind
    )
      return true;
  }
  return false;
}
export function hasCurrentMechanicalKillMode(world: World, role: RoleComponent): boolean {
  return hasCurrentMechanicalMode(world, role, "kill");
}
