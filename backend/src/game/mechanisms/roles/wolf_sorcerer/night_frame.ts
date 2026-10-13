/**
 * Owns Wolf Sorcerer native exchange and night target-remapping receipts. Inputs are original
 * participants and the paired choice; outputs are current remaps, pack readiness and close/abort
 * decisions. Only the bound original players share an exchange, without silently replacing its
 * source.
 */
import type { WolfSorcererReadState } from "@ai-werewolf-arena/game-contract";
import { resolveOrderedSeatTarget } from "./seat_mapping";
import { types } from "node:util";
import { COMPONENT, type RoleComponent, type World } from "../../../../core";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../../../core/domain/components/alive";
import type { NightLifeScope } from "../../../../core/domain/night_effects";
import { getWolfSorcererState, projectWolfSorcererState, WOLF_SORCERER_ROLE } from "./state";

interface OriginalPlayer {
  id: number;
  role: RoleComponent;
  roleName: RoleComponent["role"];
  camp: RoleComponent["camp"];
  privateState: RoleComponent["privateState"];
  identity: unknown;
  seat: number;
  name: string;
  sessionId: string;
  life: AliveComponent;
  version: number;
}
interface ExchangeNight {
  day: number;
  closed: boolean;
  committed: boolean;
  pair: readonly [number, number] | null;
  targets: ReadonlyMap<number, OriginalPlayer>;
}
interface Board {
  actorId: number;
  state: WolfSorcererReadState;
  expectedState: string;
  players: ReadonlyMap<number, OriginalPlayer>;
  night: ExchangeNight | null;
}
const boards = new WeakMap<World, Board>();
function stateIdentity(role: RoleComponent): string {
  const view = projectWolfSorcererState(role);
  if (!view) throw new Error("wolf_sorcerer_original_state_revoked");
  return JSON.stringify(view);
}
function ownData(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
function originalPlayer(world: World, p: OriginalPlayer): boolean {
  if (
    world.getComponent(p.id, COMPONENT.Role) !== p.role ||
    ownData(p.role, "role") !== p.roleName ||
    ownData(p.role, "camp") !== p.camp ||
    ownData(p.role, "privateState") !== p.privateState ||
    world.getComponent(p.id, COMPONENT.Identity) !== p.identity ||
    ownData(p.identity, "id") !== p.id ||
    ownData(p.identity, "seat") !== p.seat ||
    ownData(p.identity, "name") !== p.name ||
    ownData(p.identity, "sessionId") !== p.sessionId ||
    world.getComponent(p.id, COMPONENT.Alive) !== p.life
  )
    return false;
  const expected = aliveLifeDescriptor(p.life);
  const current = Object.getOwnPropertyDescriptor(p.life, "alive");
  if (
    !expected ||
    !current ||
    current.get !== expected.get ||
    current.set !== expected.set ||
    current.enumerable !== expected.enumerable ||
    current.configurable !== expected.configurable
  )
    return false;
  const version = aliveLifeVersion(p.life);
  // A committed exchange survives one ordinary death, never revival or another life.
  return p.life.alive ? version === p.version : version === p.version + 1;
}
function requireBoard(world: World): Board {
  const b = boards.get(world);
  if (!b) throw new Error("wolf_sorcerer_board_missing");
  const ids = world.entityIds();
  if (
    ids.length !== b.players.size ||
    ids.some((id) => !b.players.has(id)) ||
    [...b.players.values()].some((p) => !originalPlayer(world, p))
  )
    throw new Error("wolf_sorcerer_original_state_revoked");
  const actor = b.players.get(b.actorId)!;
  if (getWolfSorcererState(actor.role) !== b.state || stateIdentity(actor.role) !== b.expectedState)
    throw new Error("wolf_sorcerer_original_state_revoked");
  return b;
}
export function installWolfSorcererBoard(world: World): void {
  if (boards.has(world)) throw new Error("wolf_sorcerer_board_already_installed");
  const players = new Map<number, OriginalPlayer>();
  const seats = new Set<number>();
  let actorId: number | null = null;
  let state: WolfSorcererReadState | undefined;
  for (const id of world.entityIds()) {
    const role = world.getComponent(id, COMPONENT.Role);
    const life = world.getComponent(id, COMPONENT.Alive);
    const version = life && aliveLifeVersion(life);
    if (!role || !life || types.isProxy(life) || version === undefined)
      throw new Error("wolf_sorcerer_original_roster_invalid");
    const expected = aliveLifeDescriptor(life);
    const descriptor = Object.getOwnPropertyDescriptor(life, "alive");
    if (
      !expected ||
      !descriptor ||
      expected.get !== descriptor.get ||
      expected.set !== descriptor.set ||
      expected.enumerable !== descriptor.enumerable ||
      expected.configurable !== descriptor.configurable ||
      !life.alive
    )
      throw new Error("wolf_sorcerer_original_roster_invalid");
    if (
      ownData(role, "role") === undefined ||
      ownData(role, "camp") === undefined ||
      ownData(role, "privateState") === undefined
    )
      throw new Error("wolf_sorcerer_original_roster_invalid");
    const identity = world.getComponent(id, COMPONENT.Identity);
    const seat = ownData(identity, "seat"),
      name = ownData(identity, "name"),
      sessionId = ownData(identity, "sessionId");
    if (
      ownData(identity, "id") !== id ||
      typeof seat !== "number" ||
      !Number.isSafeInteger(seat) ||
      seat <= 0 ||
      seats.has(seat) ||
      typeof name !== "string" ||
      typeof sessionId !== "string"
    )
      throw new Error("wolf_sorcerer_original_roster_invalid");
    seats.add(seat);
    players.set(id, {
      id,
      role,
      roleName: role.role,
      camp: role.camp,
      privateState: role.privateState,
      identity,
      seat,
      name,
      sessionId,
      life,
      version,
    });
    if (String(role.role) === WOLF_SORCERER_ROLE) {
      if (actorId !== null) throw new Error("wolf_sorcerer_original_roster_invalid");
      actorId = id;
      state = getWolfSorcererState(role);
    }
  }
  if (actorId === null || !state || state.history.length !== 0)
    throw new Error("wolf_sorcerer_original_roster_invalid");
  boards.set(world, {
    actorId,
    state,
    expectedState: stateIdentity(players.get(actorId)!.role),
    players,
    night: null,
  });
}
export function isWolfSorcererBoard(world: World): boolean {
  if (!boards.has(world)) return false;
  requireBoard(world);
  return true;
}
export function beginWolfSorcererNight(world: World, day: number): number | null {
  const b = requireBoard(world);
  if (
    !Number.isSafeInteger(day) ||
    day <= 0 ||
    day >= Number.MAX_SAFE_INTEGER ||
    (!b.night && day !== 1) ||
    (b.night && (!b.night.closed || day !== b.night.day + 1))
  )
    throw new Error("wolf_sorcerer_night_invalid");
  const used = new Set<number>();
  for (const choice of projectWolfSorcererState(b.players.get(b.actorId)!.role)!.history)
    if (choice.pair) {
      used.add(choice.pair[0]);
      used.add(choice.pair[1]);
    }
  const targets = new Map([...b.players].filter(([id, p]) => p.life.alive && !used.has(id)));
  const eligible =
    day >= b.state.firstNight && b.players.get(b.actorId)!.life.alive && targets.size >= 2;
  b.night = { day, closed: false, committed: !eligible, pair: null, targets };
  return eligible ? b.actorId : null;
}
export function wolfSorcererChoiceTargets(world: World, day: number): number[] {
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.day !== day || n.closed || n.committed) return [];
  return [...n.targets.values()].filter((p) => p.life.alive).map((p) => p.id);
}
export function commitWolfSorcererExchange(
  world: World,
  actorId: number,
  day: number,
  pair: readonly [number, number] | null,
): void {
  const b = requireBoard(world),
    n = b.night;
  if (
    !n ||
    n.day !== day ||
    n.closed ||
    n.committed ||
    b.actorId !== actorId ||
    !b.players.get(actorId)!.life.alive
  )
    throw new Error("wolf_sorcerer_choice_scope_invalid");
  let chosen: [number, number] | null = null;
  if (pair !== null) {
    if (types.isProxy(pair) || !Array.isArray(pair))
      throw new Error("wolf_sorcerer_choice_target_invalid");
    const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
      pair as object,
    );
    const a = descriptors["0"]?.value,
      z = descriptors["1"]?.value;
    if (
      Reflect.ownKeys(descriptors).length !== 3 ||
      descriptors.length?.value !== 2 ||
      !Number.isSafeInteger(a) ||
      !Number.isSafeInteger(z) ||
      a <= 0 ||
      z <= 0
    )
      throw new Error("wolf_sorcerer_choice_target_invalid");
    if (a === z || !n.targets.get(a)?.life.alive || !n.targets.get(z)?.life.alive)
      throw new Error("wolf_sorcerer_choice_target_invalid");
    chosen = a < z ? [a, z] : [z, a];
  }
  Object.defineProperty(b.state.history, String(b.state.history.length), {
    value: { day, pair: chosen },
    writable: true,
    enumerable: true,
    configurable: true,
  });
  b.expectedState = stateIdentity(b.players.get(actorId)!.role);
  n.pair = chosen && Object.freeze([chosen[0], chosen[1]] as [number, number]);
  n.committed = true;
}
export interface WolfSorcererResolvedTarget {
  readonly requestedId: number;
  readonly effectiveId: number;
  readonly scope: NightLifeScope;
  readonly isCurrent: () => boolean;
}
export function resolveWolfSorcererNightTarget(
  world: World,
  day: number,
  requestedId: number,
  kind: "night_action" | "death_shot" | "original" | "intermediate" = "night_action",
): WolfSorcererResolvedTarget {
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.day !== day || n.closed || !n.committed)
    throw new Error("wolf_sorcerer_night_unsettled");
  const original = b.players.get(requestedId);
  if (!original || !original.life.alive) throw new Error("wolf_sorcerer_target_invalid");
  const pair = kind === "original" ? null : n.pair;
  const effectiveId = resolveOrderedSeatTarget(requestedId, null, pair);
  const effective = b.players.get(effectiveId)!;
  if (kind === "night_action" && !effective.life.alive)
    throw new Error("wolf_sorcerer_target_invalid");
  const nightPair = n.pair;
  const requestedVersion = aliveLifeVersion(original.life)!;
  const scope: NightLifeScope = Object.freeze({
    id: effectiveId,
    life: effective.life,
    version: aliveLifeVersion(effective.life)!,
  });
  return Object.freeze({
    requestedId,
    effectiveId,
    scope,
    isCurrent: () => {
      try {
        return (
          requireBoard(world) === b &&
          b.night === n &&
          n.pair === nightPair &&
          !n.closed &&
          originalPlayer(world, original) &&
          originalPlayer(world, effective) &&
          original.life.alive &&
          aliveLifeVersion(original.life) === requestedVersion &&
          aliveLifeVersion(effective.life) === scope.version
        );
      } catch {
        return false;
      }
    },
  });
}
export function closeWolfSorcererNight(world: World, day: number): void {
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.day !== day || n.closed || !n.committed)
    throw new Error("wolf_sorcerer_night_unsettled");
  n.closed = true;
}

export function assertWolfSorcererRosterCurrent(world: World): void {
  requireBoard(world);
}
export function wolfSorcererChoicePending(world: World, actorId: number, day: number): boolean {
  const b = requireBoard(world),
    n = b.night;
  return (
    b.actorId === actorId &&
    !!n &&
    n.day === day &&
    !n.closed &&
    !n.committed &&
    b.players.get(actorId)!.life.alive
  );
}

/** Cleanup only: never validates or repairs a revoked roster, and never records a choice. */
export function abortWolfSorcererNight(world: World): void {
  const n = boards.get(world)?.night;
  if (n) n.closed = true;
}

/** Initial pack knowledge is withheld until the first eligible night choice has settled. */
export function wolfSorcererPackReady(world: World): boolean {
  const b = requireBoard(world),
    n = b.night;
  return !!n && n.day >= b.state.firstNight && n.committed;
}

export function wolfSorcererActorId(world: World): number {
  return requireBoard(world).actorId;
}
