/**
 * Owns Fragrant's original roster, controller leases, paid relation and publications.
 * Inputs are original World bodies and scoped night/death choices; outputs are
 * current permissions, committed receipts and compatible authority snapshots.
 * Pair payload/audit writes use the captured typed slot owner after the original
 * checks; lease commitment and later request settlement retain their old order.
 * Closed or aborted nights never redraw knowledge or refund a paid relation.
 */
import { types } from "node:util";
import type { FragrantPlayerState } from "@ai-werewolf-arena/game-text";
import type { World } from "../../../../core/domain/world";
import type { GameEvent } from "../../../../core/domain/events";
import type { RandomDraws } from "../../../../core/domain/random";
import { COMPONENT } from "../../../../core/domain/components/names";
import { Camp, Role, Phase } from "../../../../core/domain/identity";
import { snapshotPlainData } from "../../../../core/domain/plain_data";
import { abilityStatus, type NightAbility } from "../abilities";
import { plainJson, write } from "./owned-state-data";
import { commitPairStateSlot, type PairStateSlot } from "./pair-state-slot";
import {
  capturePairTarget,
  pairTargetCurrent,
  pairTargetOriginal,
  capturedPairContainsWolf,
  type PairTargetScope,
} from "./target_scope";
import {
  readFragrantState,
  readPairSeerState,
  expireFragrantAtNightOpen,
  commitKnownWolf,
  chooseFragrantPair,
  appendPairCheck,
  triggerFragrantPair,
  normalizePair,
  type FragrantState,
  type PairSeerState,
  type Pair,
} from "./state";
import {
  freshFragrantKnowledge,
  readFragrantKnowledge,
  knowFragrantNightOpen,
  knowFragrantWolf,
  knowFragrantKnife,
  knowFragrantChoice,
  knowFragrantPublishedDeaths,
  type FragrantKnowledge,
} from "./knowledge";

const invalidField = Symbol("fragrant_invalid_field");
function own(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return invalidField;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : d ? invalidField : undefined;
}
function eventFeed(events: GameEvent[]): GameEvent[] | null {
  if (
    types.isProxy(events) ||
    !Array.isArray(events) ||
    Object.getPrototypeOf(events) !== Array.prototype
  )
    return null;
  const fields: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
      events as object,
    ),
    length = fields.length?.value;
  if (!Number.isSafeInteger(length) || length < 0 || Reflect.ownKeys(fields).length !== length + 1)
    return null;
  const result: GameEvent[] = [];
  for (let i = 0; i < length; i++) {
    const d = fields[String(i)];
    if (!d || !("value" in d) || typeof own(d.value, "type") !== "string") return null;
    result.push(d.value as GameEvent);
  }
  return result;
}
interface PhaseFact {
  readonly index: number;
  readonly day: number;
  readonly phase: Phase;
}
function phaseFacts(feed: readonly GameEvent[]): readonly PhaseFact[] | null {
  const facts: PhaseFact[] = [];
  let previous = 0;
  for (const [index, event] of feed.entries()) {
    if (own(event, "type") !== "phase_changed") continue;
    const payload = own(event, "payload"),
      day = own(payload, "day"),
      phase = own(payload, "phase");
    if (
      own(event, "audience") !== undefined ||
      typeof day !== "number" ||
      !Number.isSafeInteger(day) ||
      day < 1 ||
      day < previous ||
      typeof phase !== "string" ||
      !Object.values(Phase).includes(phase as Phase)
    )
      return null;
    previous = day;
    facts.push({ index, day, phase: phase as Phase });
  }
  return facts;
}
interface OriginalPlayer {
  readonly target: PairTargetScope;
  readonly privateState: Record<string, unknown>;
  readonly identity: unknown;
  readonly identityJson: string;
  readonly victory: unknown;
  readonly victoryJson: string;
}
function capturePlayer(world: World, id: number): OriginalPlayer {
  const target = capturePairTarget(world, id),
    privateState = target && own(target.role, "privateState"),
    identity = world.getComponent(id, COMPONENT.Identity),
    victory = world.getComponent(id, COMPONENT.Victory),
    identityJson = plainJson(identity),
    victoryJson = plainJson(victory);
  if (
    !target ||
    !privateState ||
    typeof privateState !== "object" ||
    types.isProxy(privateState) ||
    Array.isArray(privateState) ||
    identityJson === null ||
    own(identity, "id") !== id ||
    !Number.isSafeInteger(own(identity, "seat")) ||
    Number(own(identity, "seat")) < 1 ||
    typeof own(identity, "name") !== "string" ||
    !String(own(identity, "name")).trim() ||
    typeof own(identity, "sessionId") !== "string" ||
    !String(own(identity, "sessionId")).trim() ||
    victoryJson !==
      JSON.stringify({ affiliations: [{ kind: "faction", faction: target.campValue }] })
  )
    throw Error("fragrant_initial_player_invalid");
  return {
    target,
    privateState: privateState as Record<string, unknown>,
    identity,
    identityJson,
    victory,
    victoryJson,
  };
}
function original(world: World, p: OriginalPlayer, living = false): boolean {
  return (
    pairTargetOriginal(world, p.target, !living) &&
    own(p.target.role, "privateState") === p.privateState &&
    world.getComponent(p.target.id, COMPONENT.Identity) === p.identity &&
    plainJson(p.identity) === p.identityJson &&
    world.getComponent(p.target.id, COMPONENT.Victory) === p.victory &&
    plainJson(p.victory) === p.victoryJson
  );
}
interface Lease {
  opened: boolean;
  committed: boolean;
  revoked: boolean;
}
interface Night {
  readonly day: number;
  readonly isCurrent: () => boolean;
  status: "open" | "normal" | "aborted";
  readonly knife: boolean;
  readonly requiresBind: boolean;
  readonly requiresPair: boolean;
  readonly bind: Lease;
  readonly pair: Lease;
}
interface PaidBinding {
  readonly day: number;
  readonly targets: readonly [PairTargetScope, PairTargetScope];
}
interface Owner extends PairStateSlot {
  readonly world: World;
  readonly events: GameEvent[];
  readonly players: ReadonlyMap<number, OriginalPlayer>;
  readonly phantom: OriginalPlayer;
  readonly seer: OriginalPlayer;
  readonly wolves: readonly OriginalPlayer[];
  readonly fragrant: FragrantState;
  readonly pairSource: NightAbility<"pair_check">["source"];
  readonly abilities: unknown;
  fragrantJson: string;
  knowledge: FragrantKnowledge;
  active: Night | null;
  readonly nights: Map<number, Night>;
  paid: PaidBinding | null;
  checking: boolean;
  pendingWave: FragrantWaveReceipt | null;
}
const owners = new WeakMap<World, Owner>();
function requireOwner(world: World): Owner {
  const o = owners.get(world);
  if (
    !o ||
    o.checking ||
    world.entityIds().length !== o.players.size ||
    [...o.players.values()].some((p) => !original(world, p)) ||
    own(o.phantom.privateState, "fragrant") !== o.fragrant ||
    own(o.seer.privateState, "pairSeer") !== o.pairState ||
    own(o.seer.privateState, "abilities") !== o.abilities ||
    plainJson(o.pairAbility) !== o.pairAbilityJson ||
    o.pairAbility.source !== o.pairSource ||
    own(o.abilities, o.pairAbility.id) !== o.pairAbility ||
    o.pairAbility.state !== o.pairState ||
    JSON.stringify(readFragrantState(o.fragrant)) !== o.fragrantJson ||
    JSON.stringify(readPairSeerState(o.pairState)) !== o.pairJson
  )
    throw Error("fragrant_owner_revoked");
  return o;
}
function controlled<T>(o: Owner, callback: () => T): T {
  if (o.checking) throw Error("fragrant_controller_reentry");
  o.checking = true;
  try {
    return callback();
  } finally {
    o.checking = false;
  }
}
function requireNight(world: World, day: number): { owner: Owner; night: Night } {
  const owner = owners.get(world),
    night = owner?.active;
  if (!owner || !night || night.day !== day || night.status !== "open")
    throw Error("fragrant_night_unavailable");
  try {
    requireOwner(world);
    if (!controlled(owner, night.isCurrent)) throw Error("fragrant_night_unavailable");
    requireOwner(world);
    if (owner.active !== night || night.status !== "open")
      throw Error("fragrant_night_unavailable");
    return { owner, night };
  } catch (error) {
    night.status = "aborted";
    if (owner.active === night) owner.active = null;
    throw error;
  }
}
function commitState(o: Owner, next: FragrantState): void {
  write(o.fragrant, next);
  o.fragrantJson = JSON.stringify(next);
}
/** The owner requires the complete original native roster. No replacement resources are granted. */
export function installFragrantPairAuthority(
  world: World,
  events: GameEvent[],
  phantomId: number,
  seerId: number,
): void {
  if (owners.has(world)) throw Error("fragrant_already_installed");
  if (
    types.isProxy(events) ||
    !Array.isArray(events) ||
    Object.getPrototypeOf(events) !== Array.prototype
  )
    throw Error("fragrant_initial_events_invalid");
  const players = new Map(world.entityIds().map((id) => [id, capturePlayer(world, id)])),
    phantom = players.get(phantomId),
    seer = players.get(seerId),
    fragrant = phantom && own(phantom.privateState, "fragrant"),
    pairState = seer && own(seer.privateState, "pairSeer"),
    f = readFragrantState(fragrant),
    s = readPairSeerState(pairState),
    rawPairAbility = seer && own(own(seer.privateState, "abilities"), "native:pair_check"),
    pairAbilityJson = plainJson(rawPairAbility),
    pairAbility = rawPairAbility as NightAbility<"pair_check"> | undefined,
    wolves = [...players.values()].filter((p) => p.target.roleId === Role.Wolf);
  const counts = new Map<Role, number>([
    [Role.FragrantPhantom, 1],
    [Role.Wolf, 3],
    [Role.Villager, 4],
    [Role.AwakenedSeer, 1],
    [Role.Witch, 1],
    [Role.Hunter, 1],
    [Role.Guard, 1],
  ]);
  const nativeRoster =
    players.size === 12 &&
    [...counts].every(
      ([role, count]) =>
        [...players.values()].filter((p) => p.target.roleId === role).length === count,
    ) &&
    [...players.values()].every(
      (p) =>
        p.target.campValue ===
        (p.target.roleId === Role.Wolf || p.target.roleId === Role.FragrantPhantom
          ? Camp.Wolf
          : Camp.Good),
    );
  if (
    !nativeRoster ||
    !phantom ||
    !seer ||
    phantom === seer ||
    phantom.target.roleId !== Role.FragrantPhantom ||
    seer.target.roleId !== Role.AwakenedSeer ||
    phantom.target.campValue !== Camp.Wolf ||
    seer.target.campValue !== Camp.Good ||
    wolves.length !== 3 ||
    wolves.includes(phantom) ||
    !f ||
    f.knowledgeNight !== null ||
    f.lastChoice !== null ||
    f.bindings.length ||
    f.trigger ||
    !s ||
    s.history.length ||
    !pairAbility ||
    pairAbilityJson === null ||
    pairAbility.state !== pairState ||
    pairAbility.kind !== "pair_check" ||
    pairAbility.id !== "native:pair_check" ||
    pairAbility.source.kind !== "native" ||
    pairAbility.source.role !== Role.AwakenedSeer ||
    pairAbility.uses !== 0 ||
    pairAbility.lastUsedDay !== null ||
    pairAbility.startsOnDay !== 1 ||
    pairAbility.maxUses !== null ||
    pairAbility.disabled !== false ||
    pairAbility.sourceDisclosed !== true ||
    pairAbility.activation !== undefined ||
    pairAbility.expiresAfterDay !== undefined ||
    pairAbility.deathExpired !== undefined ||
    pairAbility.nightSuppression !== undefined ||
    pairAbilityJson === null
  )
    throw Error("fragrant_initial_state_invalid");
  owners.set(world, {
    world,
    events,
    players,
    phantom,
    seer,
    wolves,
    fragrant: fragrant as FragrantState,
    pairState: pairState as PairSeerState,
    pairAbility,
    pairSource: pairAbility.source,
    abilities: own(seer.privateState, "abilities"),
    pairAbilityJson,
    fragrantJson: JSON.stringify(f),
    pairJson: JSON.stringify(s),
    knowledge: freshFragrantKnowledge(),
    active: null,
    nights: new Map(),
    paid: null,
    checking: false,
    pendingWave: null,
  });
}
export function isFragrantPairBoard(world: World): boolean {
  return owners.has(world);
}
/** Expiry, sole N1 draw and knife freeze commit before any asynchronous player request. */
export function beginFragrantNight(
  world: World,
  day: number,
  random: RandomDraws,
  isCurrent: () => boolean,
) {
  const o = requireOwner(world),
    lastDay = Math.max(0, ...o.nights.keys()),
    livingAtEntry = new Map([...o.players.values()].map((p) => [p.target.id, p.target.life.alive]));
  const unchangedLives = () =>
    [...o.players.values()].every((p) => p.target.life.alive === livingAtEntry.get(p.target.id));
  if (
    !Number.isSafeInteger(day) ||
    day !== lastDay + 1 ||
    (lastDay > 0 && o.nights.get(lastDay)?.status !== "normal") ||
    o.active ||
    o.pendingWave ||
    typeof isCurrent !== "function" ||
    types.isProxy(isCurrent) ||
    !controlled(o, isCurrent)
  )
    throw Error("fragrant_night_unavailable");
  requireOwner(world);
  if (o.active || o.nights.has(day) || !unchangedLives()) throw Error("fragrant_night_unavailable");
  const alive = livingAtEntry.get(o.phantom.target.id)!,
    knife = alive && o.wolves.every((p) => !livingAtEntry.get(p.target.id)),
    night: Night = {
      day,
      isCurrent,
      status: "open",
      knife,
      requiresBind: alive && !o.fragrant.trigger,
      requiresPair:
        livingAtEntry.get(o.seer.target.id)! &&
        [...livingAtEntry.values()].filter(Boolean).length >= 2,
      bind: { opened: false, committed: false, revoked: false },
      pair: { opened: false, committed: false, revoked: false },
    };
  // Reserve before entering randomness. A failed sampled night stays aborted and cannot redraw.
  o.active = night;
  o.nights.set(day, night);
  try {
    commitState(o, expireFragrantAtNightOpen(o.fragrant, day));
    o.knowledge = knowFragrantNightOpen(o.knowledge, day);
    o.paid = null;
    if (day === 1) {
      const draw = controlled(o, () => random.next());
      requireOwner(world);
      if (
        !unchangedLives() ||
        !Number.isFinite(draw) ||
        draw < 0 ||
        draw >= 1 ||
        !controlled(o, isCurrent)
      )
        throw Error("fragrant_knowledge_draw_invalid");
      requireOwner(world);
      if (!unchangedLives()) throw Error("fragrant_knowledge_draw_invalid");
      const knownId = o.wolves[Math.floor(draw * 3)]!.target.id;
      commitState(o, commitKnownWolf(o.fragrant, knownId));
      o.knowledge = knowFragrantWolf(o.knowledge, knownId);
    }
    if (alive) o.knowledge = knowFragrantKnife(o.knowledge, day, knife);
    return alive
      ? Object.freeze({
          actorId: o.phantom.target.id,
          day,
          known: readFragrantKnowledge(o.knowledge)!,
        })
      : null;
  } catch (error) {
    night.status = "aborted";
    o.active = null;
    throw error;
  }
}
function openChoice(
  world: World,
  day: number,
  kind: "bind" | "pair",
  requestCurrent?: () => boolean,
) {
  if (
    requestCurrent !== undefined &&
    (typeof requestCurrent !== "function" || types.isProxy(requestCurrent))
  )
    throw Error("fragrant_choice_unavailable");
  const { owner: o, night } = requireNight(world, day),
    actor = kind === "bind" ? o.phantom : o.seer,
    lease = night[kind];
  if (
    !(kind === "bind" ? night.requiresBind : night.requiresPair) ||
    !original(world, actor, true) ||
    lease.opened ||
    lease.committed
  )
    throw Error("fragrant_choice_unavailable");
  const candidates = [...o.players.values()]
    .filter((p) => original(world, p, true))
    .map((p) => p.target);
  lease.opened = true;
  const isCurrent = () => {
    if (lease.revoked || lease.committed) return false;
    try {
      const current = requireNight(world, day);
      let eligible =
        current.owner === o &&
        current.night === night &&
        !lease.committed &&
        original(world, actor, true) &&
        candidates.every((t) => pairTargetCurrent(world, t));
      if (eligible && requestCurrent) {
        eligible = controlled(o, requestCurrent);
        requireOwner(world);
        eligible &&=
          o.active === night &&
          night.status === "open" &&
          !lease.committed &&
          original(world, actor, true) &&
          candidates.every((t) => pairTargetCurrent(world, t));
      }
      if (!eligible) lease.revoked = true;
      return eligible;
    } catch {
      lease.revoked = true;
      return false;
    }
  };
  const targets = (value: unknown): readonly [PairTargetScope, PairTargetScope] => {
    const pair = normalizePair(value),
      a = candidates.find((s) => s.id === pair[0]),
      b = candidates.find((s) => s.id === pair[1]);
    if (!a || !b) throw Error("fragrant_pair_target_invalid");
    return [a, b];
  };
  return { o, night, lease, candidates, isCurrent, targets };
}
export function fragrantChoiceActor(
  world: World,
  day: number,
  kind: "bind" | "pair",
): number | null {
  const { owner, night } = requireNight(world, day),
    actor = kind === "bind" ? owner.phantom : owner.seer;
  return (kind === "bind" ? night.requiresBind : night.requiresPair) &&
    !night[kind].committed &&
    !night[kind].revoked &&
    original(world, actor, true)
    ? actor.target.id
    : null;
}
export function fragrantChoiceCandidates(world: World, day: number): readonly number[] {
  const { owner } = requireNight(world, day);
  return [...owner.players.values()]
    .filter((p) => original(world, p, true))
    .map((p) => p.target.id);
}
export function openFragrantBindChoice(world: World, day: number, requestCurrent?: () => boolean) {
  const c = openChoice(world, day, "bind", requestCurrent);
  return Object.freeze({
    isCurrent: c.isCurrent,
    candidates: Object.freeze(c.candidates.map((t) => t.id)),
    commit(value: unknown) {
      const pair = value === null ? null : normalizePair(value);
      if (!c.isCurrent()) throw Error("fragrant_binding_revoked");
      const targets = pair === null ? null : c.targets(pair),
        next = chooseFragrantPair(c.o.fragrant, day, pair),
        known = knowFragrantChoice(c.o.knowledge, day, pair);
      if (!c.isCurrent()) throw Error("fragrant_binding_revoked");
      commitState(c.o, next);
      c.o.knowledge = known;
      c.lease.committed = true;
      c.o.paid = targets === null ? null : { day, targets };
      return Object.freeze({ actorId: c.o.phantom.target.id, day, pairIds: pair });
    },
  });
}
export function openPairCheckChoice(world: World, day: number, requestCurrent?: () => boolean) {
  const c = openChoice(world, day, "pair", requestCurrent);
  return Object.freeze({
    isCurrent: c.isCurrent,
    candidates: Object.freeze(c.candidates.map((t) => t.id)),
    commit(value: unknown) {
      const pair = normalizePair(value);
      if (!c.isCurrent()) throw Error("fragrant_pair_check_revoked");
      const targets = c.targets(pair),
        result = capturedPairContainsWolf(world, targets);
      if (result === null) throw Error("fragrant_pair_check_revoked");
      const next = appendPairCheck(c.o.pairState, day, pair, result);
      if (!c.isCurrent()) throw Error("fragrant_pair_check_revoked");
      if (abilityStatus(c.o.pairAbility, day) !== "active")
        throw Error("fragrant_pair_check_revoked");
      commitPairStateSlot(c.o, next, day);
      c.lease.committed = true;
      return Object.freeze({
        actorId: c.o.seer.target.id,
        day,
        targetIds: pair,
        containsWerewolf: result,
      });
    },
  });
}
export function closeFragrantNight(world: World, day: number, status: "normal" | "aborted"): void {
  if (status === "aborted") {
    const owned = owners.get(world),
      night = owned?.nights.get(day);
    if (owned && night?.status === "open") {
      night.status = "aborted";
      if (owned.active === night) owned.active = null;
    }
    return;
  }
  const o = requireOwner(world),
    n = o.nights.get(day);
  if (!n || n.day !== day || n.status !== "open") throw Error("fragrant_night_unavailable");
  if (status === "normal") {
    requireNight(world, day);
    if ((n.requiresBind && !n.bind.committed) || (n.requiresPair && !n.pair.committed))
      throw Error("fragrant_required_choice_missing");
  }
  n.status = status;
  o.active = null;
}
export function fragrantKnifeEligible(world: World, actorId: number, day: number): boolean {
  try {
    const { owner, night } = requireNight(world, day);
    return (
      actorId === owner.phantom.target.id && night.knife && original(world, owner.phantom, true)
    );
  } catch {
    return false;
  }
}
export function fragrantRoleKnifeEligible(world: World, role: PairTargetScope["role"]): boolean {
  const o = owners.get(world);
  return (
    !!o &&
    o.phantom.target.role === role &&
    !!o.active &&
    fragrantKnifeEligible(world, o.phantom.target.id, o.active.day)
  );
}
/** Historical single-ID knowledge; this never returns the private original ordinary-wolf roster. */
export function fragrantKnownWolfIds(
  world: World,
  role: PairTargetScope["role"],
): readonly number[] {
  const o = requireOwner(world);
  return o.phantom.target.role !== role || o.knowledge.knownWolfId === null
    ? []
    : [o.knowledge.knownWolfId];
}
export function fragrantPlayerKnowledge(
  world: World,
  phase?: Phase,
  day?: number,
): FragrantPlayerState {
  const o = requireOwner(world),
    canVoteForKill =
      o.active &&
      (phase === undefined || phase === Phase.Night) &&
      (day === undefined || day === o.active.day)
        ? fragrantKnifeEligible(world, o.phantom.target.id, o.active.day)
        : false;
  requireOwner(world);
  const known = readFragrantKnowledge(o.knowledge)!;
  return {
    actorId: o.phantom.target.id,
    ...known,
    hasInheritedKnife: known.knifeNotices.some((n) => n.eligible),
    canVoteForKill,
  };
}
export interface FragrantWaveReceipt {
  readonly day: number;
  readonly rootId: number;
  readonly addedTargetId: number | null;
  readonly pairIds: Pair;
}
interface WaveProof {
  readonly owner: Owner;
  readonly paid: PaidBinding;
  readonly rootIds: readonly number[];
  readonly json: string;
  readonly eventStart: number;
  readonly prefix: readonly GameEvent[];
  readonly phases: readonly PhaseFact[];
  committed: boolean;
}
const waves = new WeakMap<FragrantWaveReceipt, WaveProof>();
/** Prepare only final effective living deaths; preparation does not spend the resource. */
export function prepareFragrantDeathWave(
  world: World,
  day: number,
  rootIds: unknown,
): FragrantWaveReceipt | null {
  const o = requireOwner(world),
    ids = snapshotPlainData(rootIds);
  if (
    !Array.isArray(ids) ||
    ids.some((id) => !Number.isSafeInteger(id) || Number(id) < 1) ||
    new Set(ids).size !== ids.length
  )
    throw Error("fragrant_death_wave_invalid");
  if (o.pendingWave) throw Error("fragrant_death_wave_pending");
  const paid = o.paid;
  if (!paid || paid.day !== day || o.fragrant.trigger) return null;
  if (!paid.targets.every((t) => pairTargetCurrent(world, t)))
    throw Error("fragrant_paid_targets_revoked");
  if (
    ids.some(
      (id) => !o.players.has(Number(id)) || !original(world, o.players.get(Number(id))!, true),
    )
  )
    throw Error("fragrant_death_wave_invalid");
  const rootId = ids.find((id) => paid.targets.some((t) => t.id === id));
  if (rootId === undefined) return null;
  const prefix = eventFeed(o.events),
    phases = prefix && phaseFacts(prefix);
  if (!prefix || !phases || (phases.at(-1)?.day ?? day) !== day)
    throw Error("fragrant_death_wave_invalid");
  const other = paid.targets.find((t) => t.id !== rootId)!,
    receipt = Object.freeze({
      day,
      rootId: Number(rootId),
      addedTargetId: ids.includes(other.id) ? null : other.id,
      pairIds: Object.freeze(normalizePair(paid.targets.map((t) => t.id))),
    });
  waves.set(receipt, {
    owner: o,
    paid,
    rootIds: ids as number[],
    json: o.fragrantJson,
    eventStart: prefix.length,
    prefix,
    phases,
    committed: false,
  });
  o.pendingWave = receipt;
  return receipt;
}
export function cancelFragrantDeathWave(world: World, receipt: FragrantWaveReceipt): void {
  const o = owners.get(world),
    p = waves.get(receipt);
  if (!o || !p || p.owner !== o || p.committed || o.pendingWave !== receipt)
    throw Error("fragrant_death_wave_revoked");
  o.pendingWave = null;
  waves.delete(receipt);
}
/** The resolver marks the entire validated wave synchronously before committing this receipt. */
export function commitFragrantDeathWave(world: World, receipt: FragrantWaveReceipt): void {
  const o = requireOwner(world),
    p = waves.get(receipt);
  if (
    !p ||
    p.owner !== o ||
    p.committed ||
    o.pendingWave !== receipt ||
    o.paid !== p.paid ||
    o.fragrantJson !== p.json ||
    p.paid.targets.some((t) => !pairTargetOriginal(world, t, true) || t.life.alive) ||
    p.rootIds.some(
      (id) => !original(world, o.players.get(id)!) || o.players.get(id)!.target.life.alive,
    )
  )
    throw Error("fragrant_death_wave_revoked");
  commitState(
    o,
    triggerFragrantPair(o.fragrant, receipt.day, receipt.rootId, receipt.addedTargetId),
  );
  p.committed = true;
  o.pendingWave = null;
}
/** Only an issued, actually committed wave and its public event in this game's feed disclose use. */
export function publishFragrantDeathWave(
  world: World,
  receipt: FragrantWaveReceipt,
  event: GameEvent,
): void {
  const o = requireOwner(world),
    p = waves.get(receipt),
    feed = eventFeed(o.events),
    index = feed ? feed.indexOf(event) : -1;
  if (
    !p ||
    p.owner !== o ||
    !p.committed ||
    !feed ||
    index < 0 ||
    (index < p.eventStart &&
      own(event, "type") !== "voted_out" &&
      own(event, "type") !== "wolf_self_destruct") ||
    p.prefix.some((e, i) => feed[i] !== e)
  )
    throw Error("fragrant_death_publication_invalid");
  const phases = phaseFacts(feed.slice(0, Math.max(index + 1, p.eventStart)));
  if (
    !phases ||
    (phases.at(-1)?.day ?? receipt.day) !== receipt.day ||
    (phaseFacts(feed.slice(0, index + 1))?.at(-1)?.day ?? receipt.day) !== receipt.day ||
    p.phases.some((fact, i) => JSON.stringify(phases[i]) !== JSON.stringify(fact))
  )
    throw Error("fragrant_death_publication_invalid");
  const fact = snapshotPlainData(event) as Record<string, unknown>,
    payload = fact.payload;
  if (
    Object.keys(fact).length !== 3 ||
    !Object.hasOwn(fact, "type") ||
    !Object.hasOwn(fact, "timestamp") ||
    !Object.hasOwn(fact, "payload") ||
    typeof fact.type !== "string" ||
    ![
      "night_resolved",
      "additional_deaths",
      "voted_out",
      "hunter_shot",
      "wolf_self_destruct",
    ].includes(fact.type) ||
    typeof fact.timestamp !== "number" ||
    !Number.isFinite(fact.timestamp) ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    (fact.type === "wolf_self_destruct"
      ? Object.keys(payload).length !== 2 ||
        !Object.hasOwn(payload, "wolfId") ||
        !Object.hasOwn(payload, "window") ||
        o.players.get(Number(own(payload, "wolfId")))?.target.roleId !== Role.Wolf ||
        (own(payload, "window") !== "on_pre_election" && own(payload, "window") !== "on_pre_vote")
      : fact.type === "hunter_shot"
        ? Object.keys(payload).length !== 2 ||
          !Object.hasOwn(payload, "hunterId") ||
          !Object.hasOwn(payload, "targetId") ||
          own(payload, "hunterId") !== o.players.get(Number(own(payload, "hunterId")))?.target.id ||
          o.players.get(Number(own(payload, "hunterId")))?.target.roleId !== Role.Hunter
        : Object.keys(payload).length !== 1 ||
          !Object.hasOwn(payload, fact.type === "voted_out" ? "target" : "deaths"))
  )
    throw Error("fragrant_death_publication_invalid");
  const publicPhase = phaseFacts(feed.slice(0, index + 1))?.at(-1)?.phase;
  if (
    (fact.type === "wolf_self_destruct" &&
      publicPhase !== (own(payload, "window") === "on_pre_election" ? Phase.Day : Phase.Voting)) ||
    (fact.type === "voted_out" && publicPhase !== Phase.Voting) ||
    (fact.type === "hunter_shot" && publicPhase !== Phase.Day && publicPhase !== Phase.Voting)
  )
    throw Error("fragrant_death_publication_invalid");
  const ids =
    fact.type === "wolf_self_destruct"
      ? [own(payload, "wolfId")]
      : fact.type === "voted_out"
        ? [own(payload, "target")]
        : fact.type === "hunter_shot"
          ? [own(payload, "targetId")]
          : (payload as { deaths: unknown }).deaths;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    new Set(ids).size !== ids.length ||
    ids.some(
      (id) =>
        !Number.isSafeInteger(id) ||
        !o.players.has(Number(id)) ||
        !original(world, o.players.get(Number(id))!) ||
        o.players.get(Number(id))!.target.life.alive,
    ) ||
    !receipt.pairIds.some((id) => ids.includes(id)) ||
    ((fact.type === "voted_out" ||
      fact.type === "hunter_shot" ||
      fact.type === "wolf_self_destruct") &&
      !ids.includes(receipt.rootId))
  )
    throw Error("fragrant_death_publication_invalid");
  o.knowledge = knowFragrantPublishedDeaths(o.knowledge, receipt.day, ids);
}
export function fragrantAuthoritySnapshot(world: World, complete = true) {
  // Failed checkpoints retain the original owner, even after a replacement revoked it.
  const o = complete ? requireOwner(world) : owners.get(world);
  if (!o) throw Error("fragrant_owner_missing");
  return {
    phantomId: o.phantom.target.id,
    seerId: o.seer.target.id,
    fragrant: JSON.parse(o.fragrantJson) as FragrantState,
    pairSeer: JSON.parse(o.pairJson) as PairSeerState,
    known: readFragrantKnowledge(o.knowledge)!,
    nights: [...o.nights.values()].map((n) => ({
      day: n.day,
      status: n.status,
      knife: n.knife,
      bindCommitted: n.bind.committed,
      pairCommitted: n.pair.committed,
    })),
  };
}

/** The two owner-managed private stores are reconstructed from committed receipts. */
export function fragrantCheckpointPrivateState(world: World, id: number, complete: boolean) {
  const o = owners.get(world);
  if (!o || (id !== o.phantom.target.id && id !== o.seer.target.id)) return undefined;
  if (complete) requireOwner(world);
  return id === o.phantom.target.id
    ? { fragrant: JSON.parse(o.fragrantJson) as FragrantState }
    : {
        abilities: { "native:pair_check": JSON.parse(o.pairAbilityJson) },
        pairSeer: JSON.parse(o.pairJson) as PairSeerState,
      };
}
