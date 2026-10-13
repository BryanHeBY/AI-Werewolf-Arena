/**
 * Owns Trickster exchange choices and exile substitution for the captured night. Inputs are
 * original bodies and the paired choice; outputs are exchange/cancel facts and the resolved
 * exile mapping. Finish or abort ends the exchange window without granting an old mapping to a
 * new life.
 */
import type { TricksterReadState } from "@ai-werewolf-arena/game-contract";
import { mapTricksterExileTarget } from "./exile_mapping";
import { types } from "node:util";
import { COMPONENT, type RoleComponent, type World } from "../../../../core";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../../../core/domain/components/alive";
import {
  getTricksterState,
  projectTricksterState,
  TRICKSTER_ROLE,
  nextTricksterChoice,
} from "./state";

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
  finished: boolean;
  exileResolved: boolean;
  pair: readonly [number, number] | null;
  targets: ReadonlyMap<number, OriginalPlayer>;
}
interface Board {
  actorId: number;
  state: TricksterReadState;
  expectedState: string;
  players: ReadonlyMap<number, OriginalPlayer>;
  night: ExchangeNight | null;
}
const boards = new WeakMap<World, Board>();
function stateIdentity(role: RoleComponent): string {
  const view = projectTricksterState(role);
  if (!view) throw new Error("trickster_original_state_revoked");
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
  if (!b) throw new Error("trickster_board_missing");
  const ids = world.entityIds();
  if (
    ids.length !== b.players.size ||
    ids.some((id) => !b.players.has(id)) ||
    [...b.players.values()].some((p) => !originalPlayer(world, p))
  )
    throw new Error("trickster_original_state_revoked");
  const actor = b.players.get(b.actorId)!;
  if (getTricksterState(actor.role) !== b.state || stateIdentity(actor.role) !== b.expectedState)
    throw new Error("trickster_original_state_revoked");
  return b;
}
export function installTricksterBoard(world: World): void {
  if (boards.has(world)) throw new Error("trickster_board_already_installed");
  const players = new Map<number, OriginalPlayer>();
  const seats = new Set<number>();
  let actorId: number | null = null;
  let state: TricksterReadState | undefined;
  for (const id of world.entityIds()) {
    const role = world.getComponent(id, COMPONENT.Role);
    const life = world.getComponent(id, COMPONENT.Alive);
    const version = life && aliveLifeVersion(life);
    if (!role || !life || types.isProxy(life) || version === undefined)
      throw new Error("trickster_original_roster_invalid");
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
      throw new Error("trickster_original_roster_invalid");
    if (
      ownData(role, "role") === undefined ||
      ownData(role, "camp") === undefined ||
      ownData(role, "privateState") === undefined
    )
      throw new Error("trickster_original_roster_invalid");
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
      throw new Error("trickster_original_roster_invalid");
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
    if (String(role.role) === TRICKSTER_ROLE) {
      if (actorId !== null) throw new Error("trickster_original_roster_invalid");
      actorId = id;
      state = getTricksterState(role);
    }
  }
  if (actorId === null || !state || state.history.length !== 0)
    throw new Error("trickster_original_roster_invalid");
  boards.set(world, {
    actorId,
    state,
    expectedState: stateIdentity(players.get(actorId)!.role),
    players,
    night: null,
  });
}
export function isTricksterBoard(world: World): boolean {
  if (!boards.has(world)) return false;
  requireBoard(world);
  return true;
}

export function beginTricksterNight(world: World, day: number): number | null {
  const b = requireBoard(world);
  if (
    !Number.isSafeInteger(day) ||
    day <= 0 ||
    day >= Number.MAX_SAFE_INTEGER ||
    (!b.night && day !== 1) ||
    (b.night && (!b.night.finished || day !== b.night.day + 1))
  )
    throw new Error("trickster_night_invalid");
  if (b.night) b.night.closed = true;
  const used = new Set(
    projectTricksterState(b.players.get(b.actorId)!.role)!.history.flatMap((row) => row.pair ?? []),
  );
  const targets = new Map([...b.players].filter(([id, p]) => p.life.alive && !used.has(id)));
  const eligible = b.players.get(b.actorId)!.life.alive && targets.size >= 2;
  b.night = {
    day,
    closed: false,
    committed: !eligible,
    finished: false,
    exileResolved: false,
    pair: null,
    targets,
  };
  return eligible ? b.actorId : null;
}
export function tricksterChoiceTargets(world: World, day: number): number[] {
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.day !== day || n.closed || n.committed) return [];
  return [...n.targets.values()].filter((p) => p.life.alive).map((p) => p.id);
}
export function tricksterMayPass(world: World, day: number): boolean {
  const b = requireBoard(world),
    last = b.state.history.at(-1);
  return !(last?.pair === null && last.day === day - 1);
}
export function tricksterChoicePending(world: World, actorId: number, day: number): boolean {
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
export function commitTricksterExchange(
  world: World,
  actorId: number,
  day: number,
  pair: readonly [number, number] | null,
): void {
  const b = requireBoard(world),
    n = b.night;
  if (!n || !tricksterChoicePending(world, actorId, day))
    throw new Error("trickster_choice_scope_invalid");
  const next = nextTricksterChoice(
    b.players.get(actorId)!.role,
    day,
    pair,
    tricksterChoiceTargets(world, day),
  );
  const choice = next.history.at(-1)!;
  Object.defineProperty(b.state.history, String(b.state.history.length), {
    value: choice,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  b.expectedState = stateIdentity(b.players.get(actorId)!.role);
  n.pair = choice.pair && Object.freeze([choice.pair[0], choice.pair[1]] as [number, number]);
  n.committed = true;
}
export function cancelTricksterExchange(world: World, day: number): void {
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.day !== day || n.closed || !n.committed || n.finished)
    throw new Error("trickster_night_unsettled");
  n.pair = null;
}
export function finishTricksterNight(world: World, day: number): void {
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.day !== day || n.closed || !n.committed || n.finished)
    throw new Error("trickster_night_unsettled");
  n.finished = true;
}
export function resolveTricksterExile(
  world: World,
  day: number,
  requestedId: number,
): { requestedId: number; effectiveId: number; missed: boolean } {
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.day !== day || n.closed || !n.committed || !n.finished || n.exileResolved)
    throw new Error("trickster_exile_unsettled");
  const original = b.players.get(requestedId);
  if (!original?.life.alive) throw new Error("trickster_target_invalid");
  const effectiveId = mapTricksterExileTarget(requestedId, n.pair)!;
  const effective = b.players.get(effectiveId);
  if (!effective) throw new Error("trickster_target_invalid");
  n.exileResolved = true;
  return { requestedId, effectiveId, missed: !effective.life.alive };
}
export function assertTricksterRosterCurrent(world: World): void {
  requireBoard(world);
}
export function abortTricksterNight(world: World): void {
  const n = boards.get(world)?.night;
  if (n && !n.finished) n.closed = true;
}

export function tricksterActorId(world: World): number {
  return requireBoard(world).actorId;
}

export function tricksterPackReady(world: World): boolean {
  return requireBoard(world).state.history.length > 0;
}
