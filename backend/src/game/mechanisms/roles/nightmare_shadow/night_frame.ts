import { COMPONENT } from "../../../../core/domain/components/names";
import {
  aliveLifeVersion,
  aliveLifeDescriptor,
  type AliveComponent,
} from "../../../../core/domain/components/alive";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { World } from "../../../../core/domain/world";
import { Camp, type EntityId } from "../../../../core/domain/identity";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../../../core/domain/night_effects";
import type { NightAbility } from "../abilities";
import { getNightmareShadowState, nightmareFearTargets, type NightmareShadowState } from "./state";

function stateIdentity(state: NightmareShadowState): string {
  return JSON.stringify([
    state.policy,
    state.fearActionPolicy,
    state.wolfActionPolicy,
    state.packReady,
    state.lastDay,
    state.lastTarget,
    Array.prototype.map.call(state.history, (entry: { day: number; targetId: EntityId | null }) => [
      entry.day,
      entry.targetId,
    ]),
  ]);
}
function authority(ability: NightAbility): string {
  const state = ability.state as unknown as Record<string, unknown>;
  return JSON.stringify([
    ability.id,
    ability.kind,
    ability.activation,
    ability.source,
    ability.sourceDisclosed,
    ability.startsOnDay,
    ability.expiresAfterDay,
    ability.maxUses,
    ability.disabled,
    ability.deathExpired,
    state.targetPolicy,
    state.actionPolicy,
    state.selfHealRule,
    state.knifeVisibility,
    state.potionPolicy,
    state.repeatPolicy,
    state.policy,
    state.inspectionPolicy,
    state.protectionPolicy,
  ]);
}
function captureRole(world: World, id: EntityId) {
  const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
  if (!role) throw new Error("nightmare_roster_missing");
  const kind = role.role,
    camp = role.camp,
    privateState = role.privateState;
  const life = world.getComponent<AliveComponent>(id, COMPONENT.Alive);
  const descriptor = life && aliveLifeDescriptor(life);
  const version = life && aliveLifeVersion(life);
  if (!life || !descriptor || version === undefined)
    throw new Error("nightmare_roster_life_missing");
  const lifeCurrent = () => {
    const current = Object.getOwnPropertyDescriptor(life, "alive");
    return (
      world.getComponent(id, COMPONENT.Alive) === life &&
      current?.get === descriptor.get &&
      current?.set === descriptor.set &&
      (aliveLifeVersion(life) === version ||
        (aliveLifeVersion(life) === version + 1 && !life.alive))
    );
  };
  const refs = Object.entries(privateState);
  const slots = Object.entries(privateState.abilities ?? {});
  const abilities = Object.values(
    (privateState.abilities ?? {}) as Record<string, NightAbility>,
  ).map((ability) => ({
    ability,
    state: ability.state,
    source: ability.source,
    identity: authority(ability),
  }));
  return {
    id,
    role,
    current: () =>
      lifeCurrent() &&
      world.getComponent(id, COMPONENT.Role) === role &&
      role.role === kind &&
      role.camp === camp &&
      role.privateState === privateState &&
      refs.every(([key, value]) => privateState[key] === value) &&
      Object.keys(privateState.abilities ?? {}).length === slots.length &&
      slots.every(
        ([key, value]) =>
          (privateState.abilities as Record<string, unknown> | undefined)?.[key] === value,
      ) &&
      abilities.every(
        (a) =>
          a.ability.state === a.state &&
          a.ability.source === a.source &&
          authority(a.ability) === a.identity,
      ),
  };
}
type Board = {
  actorId: EntityId;
  state: NightmareShadowState;
  expectedState: string;
  roster: ReturnType<typeof captureRole>[];
  night: {
    day: number;
    required: boolean;
    committed: boolean;
    target: NightLifeScope | null;
    wolfBlocked: boolean;
  } | null;
};
const boards = new WeakMap<World, Board>();
export function installNightmareBoard(world: World): void {
  if (boards.has(world)) throw new Error("nightmare_board_reinstall");
  const roster = world.entityIds().map((id) => captureRole(world, id));
  const actors = roster.filter((row) => getNightmareShadowState(row.role));
  if (actors.length !== 1) throw new Error("nightmare_actor_count");
  const state = getNightmareShadowState(actors[0].role)!;
  boards.set(world, {
    actorId: actors[0].id,
    state,
    expectedState: stateIdentity(state),
    roster,
    night: null,
  });
}
export function isNightmareBoard(world: World): boolean {
  return boards.has(world);
}
export function assertNightmareRosterCurrent(world: World): void {
  const board = boards.get(world);
  if (!board) return;
  if (
    world.entityIds().length !== board.roster.length ||
    board.roster.some((row) => !row.current()) ||
    getNightmareShadowState(world.getComponent<RoleComponent>(board.actorId, COMPONENT.Role)) !==
      board.state ||
    stateIdentity(board.state) !== board.expectedState
  )
    throw new Error("nightmare_roster_revoked");
}
export function beginNightmareNight(world: World, day: number): EntityId | null {
  const board = boards.get(world);
  if (!board) return null;
  assertNightmareRosterCurrent(world);
  if (
    !Number.isSafeInteger(day) ||
    day !== (board.night?.day ?? 0) + 1 ||
    (board.night?.required && !board.night.committed)
  )
    throw new Error("nightmare_night_reentry");
  board.night = {
    day,
    required: world.getAliveEntityIds().includes(board.actorId),
    committed: false,
    target: null,
    wolfBlocked: false,
  };
  return world.getAliveEntityIds().includes(board.actorId) ? board.actorId : null;
}
export function nightmarePackReady(world: World): boolean {
  assertNightmareRosterCurrent(world);
  return boards.get(world)?.state.packReady ?? true;
}
export function commitNightmareFear(
  world: World,
  actorId: EntityId,
  day: number,
  targetId: EntityId | null,
): void {
  assertNightmareRosterCurrent(world);
  const board = boards.get(world),
    night = board?.night;
  if (
    !board ||
    !night ||
    board.actorId !== actorId ||
    night.day !== day ||
    night.committed ||
    !world.getAliveEntityIds().includes(actorId)
  )
    throw new Error("nightmare_fear_scope_invalid");
  const candidates = nightmareFearTargets(world, actorId, day);
  if (
    targetId === null
      ? board.state.fearActionPolicy === "required_when_legal" && candidates.length > 0
      : !candidates.includes(targetId)
  )
    throw new Error("nightmare_fear_target_invalid");
  const target = targetId === null ? null : captureNightLife(world, targetId);
  if (targetId !== null && !target) throw new Error("nightmare_fear_target_invalid");
  const wolfBlocked =
    targetId !== null &&
    world.getComponent<RoleComponent>(targetId, COMPONENT.Role)?.camp === Camp.Wolf;
  board.state.lastDay = day;
  board.state.lastTarget = targetId;
  board.state.packReady = true;
  Array.prototype.push.call(board.state.history, { day, targetId });
  board.expectedState = stateIdentity(board.state);
  night.committed = true;
  night.target = target;
  night.wolfBlocked = wolfBlocked;
}
/** Normal first death preserves this night's silence for the death-action window. */
export function nightmareFearBlocks(
  world: World,
  id: EntityId,
  day: number,
  allowFirstDeath = false,
): boolean {
  assertNightmareRosterCurrent(world);
  const night = boards.get(world)?.night,
    target = night?.target;
  if (!night || night.day !== day || !target || target.id !== id) return false;
  if (livingNightLife(world, target)) return true;
  if (!allowFirstDeath) throw new Error("nightmare_target_life_revoked");
  return (
    world.getComponent(id, COMPONENT.Alive) === target.life &&
    !target.life.alive &&
    aliveLifeVersion(target.life) === target.version + 1
  );
}
export function nightmareKnifeBlocked(world: World, day?: number): boolean {
  assertNightmareRosterCurrent(world);
  const night = boards.get(world)?.night;
  return !!night && (day === undefined || night.day === day) && night.wolfBlocked;
}

export function nightmareFearPending(world: World, actorId: EntityId, day: number): boolean {
  assertNightmareRosterCurrent(world);
  const board = boards.get(world),
    night = board?.night;
  return (
    !!board &&
    !!night &&
    board.actorId === actorId &&
    night.day === day &&
    night.required &&
    !night.committed &&
    world.getAliveEntityIds().includes(actorId)
  );
}
