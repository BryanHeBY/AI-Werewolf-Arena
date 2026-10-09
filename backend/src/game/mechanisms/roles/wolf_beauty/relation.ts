import { AliveComponent, aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import {
  Role,
  Camp,
  DeathCause,
  type EntityId,
  type WinDecision,
} from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import { getWolfBeautyState, type WolfBeautyState } from "../private_state";
import { getDefaultRoleCatalog } from "../catalog";
import { victoryDecision } from "../../win_conditions/results";

export interface CharmBinding {
  actorId: EntityId;
  targetId: EntityId;
  role: RoleComponent;
  state: WolfBeautyState;
  actorLife: AliveComponent;
  actorVersion: number | undefined;
  targetLife: AliveComponent;
  targetVersion: number | undefined;
  resolved: boolean;
  applied: boolean;
  deathLinkPolicy: import("../../../../core/domain/board").BeautyDeathLinkPolicy;
}
const bindings = new WeakMap<World, Map<EntityId, CharmBinding>>();
export function bindCharm(world: World, actorId: EntityId, targetId: EntityId | null): void {
  const map = bindings.get(world) ?? new Map<EntityId, CharmBinding>();
  bindings.set(world, map);
  map.delete(actorId);
  if (targetId === null) return;
  const role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role)!,
    state = getWolfBeautyState(role)!,
    actorLife = world.getComponent<AliveComponent>(actorId, COMPONENT.Alive)!,
    targetLife = world.getComponent<AliveComponent>(targetId, COMPONENT.Alive)!;
  map.set(actorId, {
    actorId,
    targetId,
    role,
    state,
    actorLife,
    actorVersion: aliveLifeVersion(actorLife),
    targetLife,
    targetVersion: aliveLifeVersion(targetLife),
    resolved: false,
    applied: false,
    deathLinkPolicy: state.deathLinkPolicy ?? "awa_exile_poison_v1",
  });
}
function current(world: World, binding: CharmBinding): boolean {
  return (
    world.getComponent(binding.actorId, COMPONENT.Role) === binding.role &&
    binding.role.role === Role.WolfBeauty &&
    getWolfBeautyState(binding.role) === binding.state &&
    binding.state.targetId === binding.targetId &&
    (binding.state.deathLinkPolicy ?? "awa_exile_poison_v1") === binding.deathLinkPolicy &&
    world.getComponent(binding.actorId, COMPONENT.Alive) === binding.actorLife &&
    binding.actorVersion !== undefined &&
    aliveLifeVersion(binding.actorLife) ===
      binding.actorVersion + (binding.actorLife.alive ? 0 : 1) &&
    world.getComponent(binding.targetId, COMPONENT.Alive) === binding.targetLife &&
    binding.targetVersion !== undefined &&
    aliveLifeVersion(binding.targetLife) ===
      binding.targetVersion + (binding.targetLife.alive ? 0 : 1)
  );
}
export function activeCharm(world: World, actorId: EntityId): CharmBinding | null {
  const binding = bindings.get(world)?.get(actorId);
  return binding && !binding.resolved && current(world, binding) ? binding : null;
}
/** Synchronous final consumption before the resolver adds causes or marks a life. */
export function claimCharm(
  world: World,
  binding: CharmBinding,
  eligibleDead: ReadonlySet<EntityId>,
): boolean {
  if (
    activeCharm(world, binding.actorId) !== binding ||
    binding.actorLife.alive ||
    (!binding.targetLife.alive && !eligibleDead.has(binding.targetId))
  )
    return false;
  binding.resolved = true;
  return true;
}
export function commitCharmDeath(world: World, binding: CharmBinding): boolean {
  if (
    bindings.get(world)?.get(binding.actorId) !== binding ||
    !binding.resolved ||
    !current(world, binding) ||
    binding.targetLife.alive
  )
    return false;
  binding.applied = true;
  return true;
}
export interface BeautyExileCandidate {
  actorId: EntityId;
  targetId: EntityId;
  side: "god" | "villager";
  binding: CharmBinding;
}
/** Called only by the manager after a real exile is decided, before the whole death wave. */
export function captureBeautyExile(world: World, actorId: EntityId): BeautyExileCandidate | null {
  const actor = world.getComponent<RoleComponent>(actorId, COMPONENT.Role),
    binding = activeCharm(world, actorId);
  if (
    actor?.role !== Role.WolfBeauty ||
    actor.camp !== Camp.Wolf ||
    !binding ||
    !binding.targetLife.alive
  )
    return null;
  if (
    world
      .getAliveEntityIds()
      .some(
        (id) =>
          id !== actorId &&
          world.getComponent<RoleComponent>(id, COMPONENT.Role)?.camp === Camp.Wolf,
      )
  )
    return null;
  const target = world.getComponent<RoleComponent>(binding.targetId, COMPONENT.Role),
    side = target ? getDefaultRoleCatalog().get(target.role)?.goodSide : undefined;
  return target?.camp === Camp.Good && side
    ? { actorId, targetId: binding.targetId, side, binding }
    : null;
}
export function resolveBeautyExileVictory(
  world: World,
  candidate: BeautyExileCandidate | null,
): WinDecision | null {
  if (
    !candidate ||
    !candidate.binding.applied ||
    !current(world, candidate.binding) ||
    candidate.binding.targetLife.alive
  )
    return null;
  const sideAlive = world.getAliveEntityIds().some((id) => {
    const role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
    return (
      role?.camp === Camp.Good &&
      getDefaultRoleCatalog().get(role.role)?.goodSide === candidate.side
    );
  });
  return sideAlive
    ? null
    : victoryDecision(world, { kind: "faction", faction: Camp.Wolf }, "wolf_beauty_last_exile");
}
export function permitsCharm(
  sources: readonly DeathCause[],
  policy: import("../../../../core/domain/board").BeautyDeathLinkPolicy = "awa_exile_poison_v1",
  nativeHunterShot = false,
): boolean {
  // S7 specifies exile/native Hunter. Missing compound rules use suppression first.
  if (policy === "heroes_s7_2017_exile_hunter_v1")
    return (
      sources.length > 0 &&
      sources.every(
        (source) => source === DeathCause.Exile || (source === DeathCause.Shot && nativeHunterShot),
      )
    );
  if (policy !== "awa_exile_poison_v1") return false;
  return (
    !sources.includes(DeathCause.Duel) &&
    !sources.includes(DeathCause.Dream) &&
    sources.some((source) => source === DeathCause.Exile || source === DeathCause.Poison)
  );
}
