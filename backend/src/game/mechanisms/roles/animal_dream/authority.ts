import { types } from "node:util";
import type { World } from "../../../../core/domain/world";
import { Camp } from "../../../../core/domain/identity";
import { snapshotPlainData } from "../../../../core/domain/plain_data";
import { aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import { bindCharm } from "../wolf_beauty/relation";
import {
  installAnimalRoster,
  animalRosterCurrent,
  animalOriginalPlayer,
  animalOriginalRolePlayer,
  animalRosterPolicies,
  type AnimalOriginalPlayer,
} from "./roster";
import {
  freshFoxCubState,
  freshPufferfishState,
  freshWhiteCatState,
  readFoxCubState,
  readPufferfishState,
  readWhiteCatState,
  payFoxCubChoice,
  deferWhiteCat,
  expireWhiteCat,
  payPufferfishChoice,
  notePufferfishKnifeDeath,
  type AnimalDeathUnit,
  type FoxCubState,
  type PufferfishState,
  type WhiteCatState,
} from "./state";

interface Resource<T extends object> {
  readonly actor: AnimalOriginalPlayer;
  readonly key: string;
  state: object;
  json: string;
  readonly read: (value: unknown) => T;
}
interface FoxLease {
  opened: boolean;
  paid: boolean;
  closed: boolean;
  checking: boolean;
  readonly requests: Set<object>;
  readonly beauty: object;
  readonly beautyJson: string;
}
interface AnimalNight {
  readonly day: number;
  readonly current: () => boolean;
  status: "starting" | "open" | "closing" | "normal" | "aborted";
  readonly requiresFox: boolean;
  readonly pufferWasAlive: boolean;
  readonly pufferVersion: number;
  readonly fox: FoxLease;
}
interface FoxEffect {
  day: number;
  targetId: number;
  knifeBlocked: boolean;
  beautyBlocked: boolean;
}
interface Owner {
  readonly fox: Resource<FoxCubState>;
  readonly puffer: Resource<PufferfishState>;
  readonly cat: Resource<WhiteCatState>;
  stopped: boolean;
  night: AnimalNight | null;
  effect: FoxEffect | null;
  checkingDeath: boolean;
  completedUnits: number;
  lastUnitDay: number;
  unit: OwnedUnit | null;
  beautyLinkBlockedDay: number | null;
}
interface AcceptedBallot {
  readonly voter: AnimalOriginalPlayer;
  readonly target: AnimalOriginalPlayer | null;
  readonly abstain: boolean;
  readonly weight: number;
  readonly voting: object;
}
interface PufferLease {
  readonly targets: readonly AnimalOriginalPlayer[];
  readonly requests: Set<object>;
  paid: boolean;
  closed: boolean;
  activated: boolean;
}
interface OwnedUnit {
  readonly token: object;
  readonly value: Readonly<AnimalDeathUnit>;
  readonly current: () => boolean;
  status: "starting" | "open" | "closing" | "closed" | "aborted";
  expiryPrepared: boolean;
  expiryCatId: number | null;
  readonly rounds: Map<1 | 2, readonly AcceptedBallot[]>;
  finalRound: 1 | 2 | null;
  puffer: PufferLease | null;
}
const owners = new WeakMap<World, Owner>();
interface FoxRequest {
  readonly world: World;
  readonly night: AnimalNight;
  readonly deadlineAtMs: number | null;
  revoked: boolean;
}
const foxRequests = new WeakMap<object, FoxRequest>();
const pufferRequests = new WeakMap<
  object,
  {
    world: World;
    unit: OwnedUnit;
    deadlineAtMs: number | null;
    revoked: boolean;
  }
>();
const now = Date.now.bind(Date);
function descriptor(value: unknown, key: string): PropertyDescriptor | undefined {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d && d.enumerable ? d : undefined;
}
function plainJson(value: unknown): string | null {
  try {
    return JSON.stringify(snapshotPlainData(value, new Set(), 0, 65536));
  } catch {
    return null;
  }
}
function captureResource<T extends object>(
  world: World,
  role: "fox_cub" | "pufferfish" | "white_cat",
  key: string,
  read: (value: unknown) => T,
  fresh: T,
): Resource<T> {
  const actor = animalOriginalRolePlayer(world, role),
    d = actor && descriptor(actor.privateState, key),
    value = d?.value,
    json = plainJson(value);
  if (
    !actor ||
    !d?.writable ||
    json === null ||
    JSON.stringify(read(value)) !== JSON.stringify(fresh)
  )
    throw Error("animal_initial_resource_invalid");
  return { actor, key, state: value as object, json, read };
}
function resourceCurrent<T extends object>(r: Resource<T>): boolean {
  const d = descriptor(r.actor.privateState, r.key);
  return !!d?.writable && d.value === r.state && plainJson(r.state) === r.json;
}
function stop(owner: Owner): void {
  owner.stopped = true;
  if (owner.night) {
    owner.night.status = "aborted";
    owner.night.fox.closed = true;
  }
  if (owner.unit && owner.unit.status !== "closed") owner.unit.status = "aborted";
  if (owner.unit?.puffer) owner.unit.puffer.closed = true;
}
function rejectDeathReentry(owner: Owner): void {
  if (!owner.checkingDeath) return;
  stop(owner);
  throw Error("animal_death_scope_reentry");
}
function currentOwner(world: World): Owner | null {
  const owner = owners.get(world);
  if (!owner || owner.stopped) return null;
  if (
    !animalRosterCurrent(world) ||
    !resourceCurrent(owner.fox) ||
    !resourceCurrent(owner.puffer) ||
    !resourceCurrent(owner.cat)
  ) {
    stop(owner);
    return null;
  }
  return owner;
}
function beautyState(world: World): { value: object; json: string } | null {
  const actor = animalOriginalRolePlayer(world, "wolf_beauty"),
    d = actor && descriptor(actor.privateState, "wolf_beauty"),
    value = d?.value,
    json = plainJson(value),
    target = descriptor(value, "targetId");
  if (!value || typeof value !== "object" || !target?.writable || json === null) return null;
  return { value, json };
}
/** Sole owner of three native resources; original roster installation cannot be repeated. */
export function installAnimalAuthority(world: World, config: unknown): void {
  if (owners.has(world)) throw Error("animal_authority_already_installed");
  installAnimalRoster(world, config);
  const fox = captureResource(world, "fox_cub", "foxCub", readFoxCubState, freshFoxCubState()),
    puffer = captureResource(
      world,
      "pufferfish",
      "pufferfish",
      readPufferfishState,
      freshPufferfishState(),
    ),
    cat = captureResource(world, "white_cat", "whiteCat", readWhiteCatState, freshWhiteCatState());
  if (!beautyState(world)) throw Error("animal_initial_resource_invalid");
  owners.set(world, {
    fox,
    puffer,
    cat,
    stopped: false,
    night: null,
    effect: null,
    checkingDeath: false,
    completedUnits: 0,
    lastUnitDay: 0,
    unit: null,
    beautyLinkBlockedDay: null,
  });
}
/** Reservation precedes the phase callback, so reentry or a failed callback never reopens this night. */
export function beginAnimalNight(world: World, day: number, isCurrent: () => boolean): void {
  const owner = currentOwner(world);
  if (owner) rejectDeathReentry(owner);
  if (
    !owner ||
    !Number.isSafeInteger(day) ||
    day !== (owner.night?.day ?? 0) + 1 ||
    (owner.night && owner.night.status !== "normal") ||
    (owner.unit && owner.unit.status !== "closed") ||
    typeof isCurrent !== "function"
  )
    throw Error("animal_night_unavailable");
  const beauty = beautyState(world);
  if (!beauty) {
    stop(owner);
    throw Error("animal_resource_revoked");
  }
  const state = readFoxCubState(JSON.parse(owner.fox.json));
  const lives = world.entityIds().map((id) => {
    const player = animalOriginalPlayer(world, id, false)!;
    return { player, version: aliveLifeVersion(player.scope.life) };
  });
  const night: AnimalNight = {
    day,
    current: isCurrent,
    status: "starting",
    requiresFox: day >= 2 && state.usedNight === null && owner.fox.actor.scope.life.alive,
    pufferWasAlive: owner.puffer.actor.scope.life.alive,
    pufferVersion: aliveLifeVersion(owner.puffer.actor.scope.life)!,
    fox: {
      opened: false,
      paid: false,
      closed: false,
      checking: false,
      requests: new Set(),
      beauty: beauty.value,
      beautyJson: beauty.json,
    },
  };
  owner.night = night;
  try {
    if (
      isCurrent() !== true ||
      currentOwner(world) !== owner ||
      night.status !== "starting" ||
      lives.some(({ player, version }) => aliveLifeVersion(player.scope.life) !== version)
    )
      throw Error("animal_night_revoked");
    owner.effect = null;
    owner.beautyLinkBlockedDay = null;
    night.status = "open";
  } catch (error) {
    stop(owner);
    throw error;
  }
}
function foxCurrent(world: World, owner: Owner, night: AnimalNight): boolean {
  const lease = night.fox;
  if (
    lease.checking ||
    lease.closed ||
    lease.paid ||
    !lease.opened ||
    night.status !== "open" ||
    owner.night !== night ||
    currentOwner(world) !== owner ||
    !night.requiresFox ||
    !animalOriginalPlayer(world, owner.fox.actor.scope.id)
  )
    return false;
  lease.checking = true;
  try {
    if (night.current() !== true) throw Error("animal_fox_lease_revoked");
    const beauty = beautyState(world);
    if (
      currentOwner(world) !== owner ||
      night.status !== "open" ||
      lease.closed ||
      lease.paid ||
      !animalOriginalPlayer(world, owner.fox.actor.scope.id) ||
      !beauty ||
      beauty.value !== lease.beauty ||
      beauty.json !== lease.beautyJson
    )
      throw Error("animal_fox_lease_revoked");
    // The only external callback has finished. These checks read private data only:
    // no later alias callback can revoke an earlier deadline or request sample.
    const checkedAt = now();
    for (const token of lease.requests) {
      const request = foxRequests.get(token);
      if (
        !request ||
        request.world !== world ||
        request.night !== night ||
        request.revoked ||
        (request.deadlineAtMs !== null && request.deadlineAtMs <= checkedAt)
      )
        throw Error("animal_fox_lease_revoked");
    }
    return true;
  } catch {
    lease.closed = true;
    return false;
  } finally {
    lease.checking = false;
  }
}
function replaceResource<T extends object>(r: Resource<T>, next: T, encoded: string): void {
  // Each mutable slot was checked after the last external callback. No setters or callbacks are invoked.
  r.actor.privateState[r.key] = next;
  r.state = next;
  r.json = encoded;
}
export function openAnimalFoxChoice(world: World, day: number, requestToken?: object) {
  const owner = currentOwner(world),
    night = owner?.night;
  if (owner) rejectDeathReentry(owner);
  if (night?.fox.checking) {
    night.fox.closed = true;
    throw Error("animal_fox_choice_unavailable");
  }
  const request = requestToken === undefined ? undefined : foxRequests.get(requestToken);
  if (
    !owner ||
    !night ||
    night.day !== day ||
    night.status !== "open" ||
    !night.requiresFox ||
    night.fox.closed ||
    night.fox.paid ||
    (requestToken !== undefined &&
      (!request || request.world !== world || request.night !== night || request.revoked))
  )
    throw Error("animal_fox_choice_unavailable");
  if (requestToken !== undefined) night.fox.requests.add(requestToken);
  night.fox.opened = true;
  return Object.freeze({
    actorId: owner.fox.actor.scope.id,
    isCurrent: () => foxCurrent(world, owner, night),
    close: () => {
      night.fox.closed = true;
    },
    commit: (targetId: number | null) => {
      if (!foxCurrent(world, owner, night)) throw Error("animal_fox_choice_unavailable");
      const target = targetId === null ? null : animalOriginalPlayer(world, targetId),
        next = payFoxCubChoice(readFoxCubState(JSON.parse(owner.fox.json)), day, targetId),
        encoded = JSON.stringify(next);
      if (targetId !== null && !target) throw Error("animal_fox_target_unavailable");
      if (
        !foxCurrent(world, owner, night) ||
        (target && animalOriginalPlayer(world, targetId!) !== target)
      )
        throw Error("animal_fox_choice_unavailable");
      const effect = target && {
        day,
        targetId: target.scope.id,
        knifeBlocked: target.scope.campValue === Camp.Wolf,
        beautyBlocked: target.scope.roleId === "wolf_beauty",
      };
      if (effect?.beautyBlocked) {
        const beauty = animalOriginalRolePlayer(world, "wolf_beauty")!;
        (night.fox.beauty as { targetId: number | null }).targetId = null;
        bindCharm(world, beauty.scope.id, null);
      }
      replaceResource(owner.fox, next, encoded);
      owner.effect = effect;
      night.fox.paid = true;
      return Object.freeze({ day, targetId });
    },
  });
}
/** Request-layer ownership: a fixed absolute deadline and terminal cancellation,
 * never arbitrary callbacks. The token is opaque and tied to this real night. */
export function createAnimalFoxRequest(world: World, day: number, deadlineAtMs?: number) {
  const owner = currentOwner(world),
    night = owner?.night;
  if (owner) rejectDeathReentry(owner);
  if (night?.fox.checking) {
    night.fox.closed = true;
    throw Error("animal_fox_request_unavailable");
  }
  if (
    !night ||
    night.day !== day ||
    night.status !== "open" ||
    !night.requiresFox ||
    night.fox.closed ||
    night.fox.paid ||
    (deadlineAtMs !== undefined && (!Number.isFinite(deadlineAtMs) || deadlineAtMs <= now()))
  )
    throw Error("animal_fox_request_unavailable");
  const token = Object.freeze({}),
    request: FoxRequest = {
      world,
      night,
      deadlineAtMs: deadlineAtMs ?? null,
      revoked: false,
    };
  foxRequests.set(token, request);
  return Object.freeze({
    token,
    revoke: () => {
      request.revoked = true;
      night.fox.closed = true;
    },
  });
}
export function closeAnimalNight(world: World, day: number, status: "normal" | "aborted"): void {
  const owner = owners.get(world),
    night = owner?.night;
  if (owner) rejectDeathReentry(owner);
  if (!owner || !night || night.day !== day) throw Error("animal_night_unavailable");
  if (status === "aborted") {
    stop(owner);
    return;
  }
  if (
    status !== "normal" ||
    currentOwner(world) !== owner ||
    night.status !== "open" ||
    (night.requiresFox && !night.fox.paid)
  )
    throw Error("animal_night_not_complete");
  night.status = "closing";
  try {
    if (night.current() !== true || currentOwner(world) !== owner || night.status !== "closing")
      throw Error("animal_night_revoked");
    night.status = "normal";
    night.fox.closed = true;
  } catch (error) {
    stop(owner);
    throw error;
  }
}
function checkDeathScope(world: World, owner: Owner, isCurrent: () => boolean): void {
  rejectDeathReentry(owner);
  if (typeof isCurrent !== "function") throw Error("animal_death_scope_unavailable");
  owner.checkingDeath = true;
  try {
    if (isCurrent() !== true || currentOwner(world) !== owner)
      throw Error("animal_death_scope_revoked");
  } catch (error) {
    stop(owner);
    throw error;
  } finally {
    owner.checkingDeath = false;
  }
}
/** Manager-issued actual exile/skip unit. PK belongs to the same token, never another unit. */
export function beginAnimalExileUnit(
  world: World,
  day: number,
  kind: AnimalDeathUnit["kind"],
  isCurrent: () => boolean,
): object {
  const owner = currentOwner(world);
  if (owner) rejectDeathReentry(owner);
  if (
    !owner ||
    owner.night?.day !== day ||
    owner.night.status !== "normal" ||
    day <= owner.lastUnitDay ||
    (owner.unit && owner.unit.status !== "closed") ||
    !["exile", "skipped_day"].includes(kind) ||
    typeof isCurrent !== "function"
  )
    throw Error("animal_exile_unit_unavailable");
  const token = Object.freeze({}),
    unit: OwnedUnit = {
      token,
      value: Object.freeze({ number: owner.completedUnits + 1, day, kind }),
      current: isCurrent,
      status: "starting",
      expiryPrepared: false,
      expiryCatId: null,
      rounds: new Map(),
      finalRound: null,
      puffer: null,
    };
  const lives = world.entityIds().map((id) => {
    const player = animalOriginalPlayer(world, id, false)!;
    return { player, version: aliveLifeVersion(player.scope.life) };
  });
  owner.unit = unit;
  try {
    checkDeathScope(world, owner, isCurrent);
    if (
      unit.status !== "starting" ||
      lives.some(({ player, version }) => aliveLifeVersion(player.scope.life) !== version)
    )
      throw Error("animal_exile_unit_revoked");
    unit.status = "open";
    return token;
  } catch (error) {
    stop(owner);
    throw error;
  }
}
function ownedUnit(world: World, token: object): { owner: Owner; unit: OwnedUnit } {
  const owner = currentOwner(world),
    unit = owner?.unit;
  if (owner) rejectDeathReentry(owner);
  if (!owner || !unit || unit.token !== token || unit.status !== "open")
    throw Error("animal_exile_unit_unavailable");
  checkDeathScope(world, owner, unit.current);
  if (unit.status !== "open") throw Error("animal_exile_unit_revoked");
  return { owner, unit };
}
/** Filter at the real lethal commit boundary, before seen/Alive/words/badge/hooks.
 * The returned ids are proposals only; DeathResolution remains the sole life writer. */
export function filterAnimalLethalWave(
  world: World,
  day: number,
  phase: "night" | "day" | "voting",
  rawIds: readonly number[],
  rawSources: Readonly<Record<number, readonly string[]>>,
  scope: object | (() => boolean),
) {
  const owner = currentOwner(world);
  if (owner) rejectDeathReentry(owner);
  if (
    !owner ||
    owner.night?.day !== day ||
    owner.night.status !== "normal" ||
    !["night", "day", "voting"].includes(phase) ||
    (owner.unit?.value.day === day && owner.unit.status !== "open") ||
    (phase === "voting" &&
      (!owner.unit ||
        owner.unit.value.kind !== "exile" ||
        owner.unit.value.day !== day ||
        owner.unit.status !== "open"))
  )
    throw Error("animal_death_scope_unavailable");
  const ids = snapshotPlainData(rawIds) as number[],
    sources = snapshotPlainData(rawSources) as Record<number, string[]>;
  if (
    !Array.isArray(ids) ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !animalOriginalPlayer(world, id))
  )
    throw Error("animal_death_proposals_invalid");
  const catId = owner.cat.actor.scope.id,
    before = readWhiteCatState(JSON.parse(owner.cat.json)),
    hasCat = ids.includes(catId),
    unit = owner.unit?.status === "open" && owner.unit.value.day === day ? owner.unit : null,
    countedUnit =
      unit &&
      (unit.value.kind === "exile" ||
        animalRosterPolicies(world)!.skippedVotePolicy === "awa_expire_on_skipped_day_v1")
        ? unit
        : null,
    next =
      hasCat && before.form.kind === "veiled"
        ? deferWhiteCat(
            before,
            day,
            phase,
            sources[catId] ?? [],
            owner.completedUnits,
            countedUnit?.value ?? null,
          )
        : before,
    encoded = JSON.stringify(next);
  if (unit ? scope !== unit.token : typeof scope !== "function")
    throw Error("animal_death_scope_unavailable");
  checkDeathScope(world, owner, unit ? unit.current : (scope as () => boolean));
  // A callback may have legally changed a life without replacing its original body.
  if (ids.some((id) => !animalOriginalPlayer(world, id))) {
    stop(owner);
    throw Error("animal_death_scope_revoked");
  }
  const blocked = hasCat && next.form.kind !== "expired";
  if (encoded !== owner.cat.json) {
    replaceResource(owner.cat, next, encoded);
    if (unit) {
      // A prior empty preparation cannot settle a clock created by a later wave.
      unit.expiryPrepared = false;
      unit.expiryCatId = null;
    }
  }
  return Object.freeze({
    deaths: Object.freeze(blocked ? ids.filter((id) => id !== catId) : [...ids]),
    revealedCatId: hasCat && before.form.kind === "veiled" ? catId : null,
    blockedCatId: blocked ? catId : null,
  });
}
/** Prepare the clock before this unit's final wave. No historical cause grants death or last words. */
export function prepareAnimalCatExpiry(world: World, token: object): number | null {
  const { owner, unit } = ownedUnit(world, token);
  if (
    unit.value.kind === "exile" &&
    (unit.finalRound === null || (unit.puffer && !unit.puffer.paid))
  )
    throw Error("animal_exile_unit_not_complete");
  if (unit.expiryPrepared) throw Error("animal_cat_expiry_already_prepared");
  const before = readWhiteCatState(JSON.parse(owner.cat.json)),
    policy = animalRosterPolicies(world)!.skippedVotePolicy,
    next = expireWhiteCat(before, unit.value, policy),
    encoded = JSON.stringify(next);
  const expires = before.form.kind === "deferred" && next.form.kind === "expired";
  if (expires && !animalOriginalPlayer(world, owner.cat.actor.scope.id)) {
    stop(owner);
    throw Error("animal_death_scope_revoked");
  }
  if (encoded !== owner.cat.json) replaceResource(owner.cat, next, encoded);
  unit.expiryPrepared = true;
  unit.expiryCatId = expires ? owner.cat.actor.scope.id : null;
  return expires ? owner.cat.actor.scope.id : null;
}
export function closeAnimalExileUnit(world: World, token: object): void {
  const { owner, unit } = ownedUnit(world, token);
  if (!unit.expiryPrepared) throw Error("animal_exile_unit_not_complete");
  if (unit.value.kind === "exile" && unit.finalRound === null)
    throw Error("animal_exile_unit_not_complete");
  if (unit.puffer && !unit.puffer.paid) throw Error("animal_exile_unit_not_complete");
  if (unit.puffer?.activated) {
    const catState = readWhiteCatState(JSON.parse(owner.cat.json));
    for (const target of unit.puffer.targets) {
      const original = animalOriginalPlayer(world, target.scope.id, false);
      if (
        !original ||
        (original.scope.life.alive &&
          !(original === owner.cat.actor && catState.form.kind === "deferred"))
      )
        throw Error("animal_exile_unit_not_complete");
    }
  }
  if (unit.expiryCatId !== null) {
    const cat = animalOriginalPlayer(world, unit.expiryCatId, false);
    if (!cat || cat.scope.life.alive) throw Error("animal_exile_unit_not_complete");
  }
  unit.status = "closing";
  const policy = animalRosterPolicies(world)!.skippedVotePolicy;
  if (unit.value.kind === "exile" || policy === "awa_expire_on_skipped_day_v1")
    owner.completedUnits = unit.value.number;
  owner.lastUnitDay = unit.value.day;
  unit.status = "closed";
  if (unit.puffer) unit.puffer.closed = true;
}
function pkCandidates(unit: OwnedUnit): number[] {
  const tally = new Map<number, number>();
  for (const vote of unit.rounds.get(1) ?? []) {
    if (!vote.abstain && vote.target)
      tally.set(vote.target.scope.id, (tally.get(vote.target.scope.id) ?? 0) + vote.weight);
  }
  const max = Math.max(0, ...tally.values()),
    tied = [...tally]
      .filter(([, weight]) => weight === max)
      .map(([id]) => id)
      .sort((a, b) => a - b);
  return tied.length > 1 ? tied : [];
}
function votingState(
  world: World,
  id: number,
): { value: object; canVote: boolean; weight: number } | null {
  const value = world.getComponent<object>(id, COMPONENT.VotingRight),
    canVote = descriptor(value, "canVote")?.value,
    weight = descriptor(value, "weight")?.value;
  return value && typeof canVote === "boolean" && (weight === 1 || weight === 1.5)
    ? { value, canVote, weight }
    : null;
}
function eligibleAnimalVoters(world: World, candidates: readonly number[]): number[] | null {
  const ids: number[] = [];
  for (const id of world.entityIds()) {
    if (!animalOriginalPlayer(world, id)) continue;
    const voting = votingState(world, id);
    if (!voting) return null;
    if (voting.canVote && !candidates.includes(id)) ids.push(id);
  }
  return ids;
}
/** Trusted VotingPipeline records the entire accepted round, including abstentions,
 * at its real acceptance boundary. No model-supplied target subset is accepted. */
export function recordAnimalBallotRound(
  world: World,
  token: object,
  round: 1 | 2,
  rawVotes: readonly {
    actorId: number;
    targetId: number | null;
    abstain: boolean;
    weight: number;
  }[],
  rawPkCandidates: readonly number[] = [],
): void {
  // Snapshot the accepted input before the first external unit guard can touch it.
  const votes = snapshotPlainData(rawVotes) as typeof rawVotes,
    candidates = snapshotPlainData(rawPkCandidates) as number[];
  const { owner, unit } = ownedUnit(world, token);
  if (
    unit.value.kind !== "exile" ||
    unit.finalRound !== null ||
    round !== unit.rounds.size + 1 ||
    (round !== 1 && round !== 2)
  )
    throw Error("animal_ballot_round_unavailable");
  if (
    !Array.isArray(votes) ||
    !Array.isArray(candidates) ||
    new Set(candidates).size !== candidates.length ||
    (round === 1 ? candidates.length !== 0 : candidates.length < 2) ||
    candidates.some((id) => !animalOriginalPlayer(world, id))
  )
    throw Error("animal_ballot_round_invalid");
  if (
    round === 2 &&
    JSON.stringify([...candidates].sort((a, b) => a - b)) !== JSON.stringify(pkCandidates(unit))
  )
    throw Error("animal_ballot_round_invalid");
  const expected = eligibleAnimalVoters(world, candidates);
  if (!expected) throw Error("animal_ballot_round_invalid");
  if (
    votes.length !== expected.length ||
    new Set(votes.map((v) => v.actorId)).size !== votes.length
  )
    throw Error("animal_ballot_round_invalid");
  const accepted: AcceptedBallot[] = votes.map((v) => {
    if (
      !v ||
      typeof v !== "object" ||
      Array.isArray(v) ||
      Object.keys(v).length !== 4 ||
      Object.keys(v).some((key) => !["actorId", "targetId", "abstain", "weight"].includes(key))
    )
      throw Error("animal_ballot_round_invalid");
    const voter = animalOriginalPlayer(world, v.actorId),
      voting = votingState(world, v.actorId),
      target = v.targetId === null ? null : animalOriginalPlayer(world, v.targetId, !v.abstain);
    if (
      !voter ||
      !voting?.canVote ||
      !expected.includes(v.actorId) ||
      typeof v.abstain !== "boolean" ||
      (v.targetId !== null &&
        (!Number.isSafeInteger(v.targetId) || v.targetId < 1 || v.targetId > 12)) ||
      v.weight !== (v.abstain ? 0 : voting.weight) ||
      (!v.abstain && (!target || (round === 2 && !candidates.includes(v.targetId!))))
    )
      throw Error("animal_ballot_round_invalid");
    return Object.freeze({
      voter,
      target,
      abstain: v.abstain,
      weight: v.weight,
      voting: voting.value,
    });
  });
  // Final guard is followed only by data checks, then the receipt is installed.
  checkDeathScope(world, owner, unit.current);
  if (
    JSON.stringify(eligibleAnimalVoters(world, candidates)) !== JSON.stringify(expected) ||
    accepted.some(
      (v) =>
        animalOriginalPlayer(world, v.voter.scope.id) !== v.voter ||
        (!v.abstain && animalOriginalPlayer(world, v.target!.scope.id) !== v.target) ||
        votingState(world, v.voter.scope.id)?.value !== v.voting ||
        votingState(world, v.voter.scope.id)?.canVote !== true ||
        (!v.abstain && votingState(world, v.voter.scope.id)?.weight !== v.weight),
    )
  ) {
    stop(owner);
    throw Error("animal_ballot_round_revoked");
  }
  unit.rounds.set(round, Object.freeze(accepted));
}
export function sealAnimalBallots(world: World, token: object): void {
  const { owner, unit } = ownedUnit(world, token);
  if (unit.value.kind !== "exile" || unit.finalRound !== null || !unit.rounds.size)
    throw Error("animal_ballot_round_unavailable");
  if (unit.rounds.size === 1 && pkCandidates(unit).length) throw Error("animal_ballot_pk_required");
  unit.finalRound = unit.rounds.size === 2 ? 2 : 1;
  const policy = animalRosterPolicies(world)!.ballotPolicy,
    selected = unit.rounds.get(policy === "awa_first_ballot_v1" ? 1 : unit.finalRound)!,
    targets = selected
      .filter((v) => !v.abstain && v.target?.scope.id === owner.puffer.actor.scope.id)
      .map((v) => v.voter)
      .sort((a, b) => a.scope.id - b.scope.id),
    stock = readPufferfishState(JSON.parse(owner.puffer.json));
  if (
    targets.length &&
    stock.usedDay === null &&
    stock.knifeDeathDay === null &&
    animalOriginalPlayer(world, owner.puffer.actor.scope.id)
  )
    unit.puffer = {
      targets: Object.freeze(targets),
      requests: new Set(),
      paid: false,
      closed: false,
      activated: false,
    };
}
export function animalPufferChoiceActor(world: World, token: object): number | null {
  const { owner, unit } = ownedUnit(world, token);
  return unit.puffer && !unit.puffer.paid && !unit.puffer.closed
    ? owner.puffer.actor.scope.id
    : null;
}
function pufferCurrent(
  world: World,
  token: object,
): { owner: Owner; unit: OwnedUnit; lease: PufferLease } {
  const { owner, unit } = ownedUnit(world, token),
    lease = unit.puffer;
  if (
    !lease ||
    lease.paid ||
    lease.closed ||
    !animalOriginalPlayer(world, owner.puffer.actor.scope.id) ||
    lease.targets.some((v) => animalOriginalPlayer(world, v.scope.id) !== v)
  )
    throw Error("animal_puffer_choice_unavailable");
  const checkedAt = now();
  for (const permit of lease.requests) {
    const r = pufferRequests.get(permit);
    if (
      !r ||
      r.world !== world ||
      r.unit !== unit ||
      r.revoked ||
      (r.deadlineAtMs !== null && r.deadlineAtMs <= checkedAt)
    ) {
      lease.closed = true;
      throw Error("animal_puffer_choice_unavailable");
    }
  }
  return { owner, unit, lease };
}
export function createAnimalPufferRequest(world: World, token: object, deadlineAtMs?: number) {
  const { unit, lease } = pufferCurrent(world, token);
  if (deadlineAtMs !== undefined && (!Number.isFinite(deadlineAtMs) || deadlineAtMs <= now()))
    throw Error("animal_puffer_request_unavailable");
  const permit = Object.freeze({}),
    r = { world, unit, deadlineAtMs: deadlineAtMs ?? null, revoked: false };
  pufferRequests.set(permit, r);
  return Object.freeze({
    token: permit,
    revoke: () => {
      r.revoked = true;
      lease.closed = true;
    },
  });
}
export function openAnimalPufferChoice(world: World, token: object, requestToken?: object) {
  const { owner, unit, lease } = pufferCurrent(world, token),
    r = requestToken === undefined ? undefined : pufferRequests.get(requestToken);
  if (requestToken !== undefined && (!r || r.world !== world || r.unit !== unit || r.revoked))
    throw Error("animal_puffer_request_unavailable");
  if (requestToken !== undefined) lease.requests.add(requestToken);
  return Object.freeze({
    actorId: owner.puffer.actor.scope.id,
    isCurrent: () => {
      try {
        pufferCurrent(world, token);
        return true;
      } catch {
        lease.closed = true;
        return false;
      }
    },
    close: () => {
      lease.closed = true;
    },
    commit: (activate: boolean) => {
      pufferCurrent(world, token);
      const targetIds = lease.targets.map((v) => v.scope.id),
        next = payPufferfishChoice(
          readPufferfishState(JSON.parse(owner.puffer.json)),
          unit.value.day,
          activate,
          targetIds,
        ),
        encoded = JSON.stringify(next);
      pufferCurrent(world, token);
      replaceResource(owner.puffer, next, encoded);
      lease.paid = true;
      lease.activated = activate;
      return Object.freeze({ day: unit.value.day, activate });
    },
  });
}
/** God/engine receipt only; already-paid effects retain original first deaths. */
export function animalPufferReaction(world: World, token: object): readonly number[] {
  const { unit } = ownedUnit(world, token),
    lease = unit.puffer;
  return Object.freeze(lease?.paid && lease.activated ? lease.targets.map((v) => v.scope.id) : []);
}
/** Actual original knife death, never a pending mark or an uncommitted proposal. */
export function commitAnimalPufferKnifeDeath(
  world: World,
  day: number,
  rawSources: readonly string[],
  scope: object | (() => boolean),
): void {
  const owner = currentOwner(world);
  if (owner) rejectDeathReentry(owner);
  const puffer = owner && animalOriginalPlayer(world, owner.puffer.actor.scope.id, false),
    sources = snapshotPlainData(rawSources) as string[],
    unit = owner?.unit?.status === "open" && owner.unit.value.day === day ? owner.unit : null;
  if (
    !owner ||
    owner.night?.day !== day ||
    owner.night.status !== "normal" ||
    !owner.night.pufferWasAlive ||
    !puffer ||
    puffer.scope.life.alive ||
    aliveLifeVersion(puffer.scope.life) !== owner.night.pufferVersion + 1 ||
    !Array.isArray(sources) ||
    !sources.includes("wolf_kill") ||
    (unit ? scope !== unit.token : typeof scope !== "function")
  )
    throw Error("animal_puffer_knife_death_unavailable");
  const next = notePufferfishKnifeDeath(readPufferfishState(JSON.parse(owner.puffer.json)), day),
    encoded = JSON.stringify(next);
  checkDeathScope(world, owner, unit ? unit.current : (scope as () => boolean));
  if (animalOriginalPlayer(world, puffer.scope.id, false) !== puffer || puffer.scope.life.alive)
    throw Error("animal_puffer_knife_death_unavailable");
  replaceResource(owner.puffer, next, encoded);
  owner.beautyLinkBlockedDay = day;
}
export function animalBeautyLinkBlocked(world: World, day: number): boolean {
  const owner = currentOwner(world);
  return owners.has(world) && (!owner || owner.beautyLinkBlockedDay === day);
}
/** God-only paid effect. Actor prompts use a separate publication-aware knowledge projection. */
export function animalFoxEffect(world: World): Readonly<FoxEffect> | null {
  const owner = currentOwner(world);
  return owner?.effect ? { ...owner.effect } : null;
}
export function animalAuthoritySnapshot(world: World, complete = true) {
  const owner = complete ? currentOwner(world) : owners.get(world);
  if (!owner) return null;
  return {
    policies: animalRosterPolicies(world),
    foxId: owner.fox.actor.scope.id,
    pufferId: owner.puffer.actor.scope.id,
    catId: owner.cat.actor.scope.id,
    fox: JSON.parse(owner.fox.json) as FoxCubState,
    puffer: JSON.parse(owner.puffer.json) as PufferfishState,
    cat: JSON.parse(owner.cat.json) as WhiteCatState,
    stopped: owner.stopped,
    night: owner.night && {
      day: owner.night.day,
      status: owner.night.status,
      requiresFox: owner.night.requiresFox,
      foxPaid: owner.night.fox.paid,
    },
    effect: owner.effect && { ...owner.effect },
    completedUnits: owner.completedUnits,
    beautyLinkBlockedDay: owner.beautyLinkBlockedDay,
    unit: owner.unit && {
      ...owner.unit.value,
      status: owner.unit.status,
      expiryPrepared: owner.unit.expiryPrepared,
      expiryCatId: owner.unit.expiryCatId,
      finalRound: owner.unit.finalRound,
      ballots: [...owner.unit.rounds].map(([round, votes]) => ({
        round,
        votes: votes.map((v) => ({
          actorId: v.voter.scope.id,
          targetId: v.target?.scope.id ?? null,
          abstain: v.abstain,
          weight: v.weight,
        })),
      })),
      puffer: owner.unit.puffer && {
        targetIds: owner.unit.puffer.targets.map((v) => v.scope.id),
        paid: owner.unit.puffer.paid,
        activated: owner.unit.puffer.activated,
        closed: owner.unit.puffer.closed,
      },
    },
  };
}
