import { types } from "node:util";
import type { World } from "../../../../core/domain/world";
import { Camp } from "../../../../core/domain/identity";
import { snapshotPlainData } from "../../../../core/domain/plain_data";
import { aliveLifeVersion } from "../../../../core/domain/components/alive";
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
}
interface OwnedUnit {
  readonly token: object;
  readonly value: Readonly<AnimalDeathUnit>;
  readonly current: () => boolean;
  status: "starting" | "open" | "closing" | "closed" | "aborted";
  expiryPrepared: boolean;
  expiryCatId: number | null;
}
const owners = new WeakMap<World, Owner>();
interface FoxRequest {
  readonly world: World;
  readonly night: AnimalNight;
  readonly deadlineAtMs: number | null;
  revoked: boolean;
}
const foxRequests = new WeakMap<object, FoxRequest>();
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
    unit: owner.unit && {
      ...owner.unit.value,
      status: owner.unit.status,
      expiryPrepared: owner.unit.expiryPrepared,
      expiryCatId: owner.unit.expiryCatId,
    },
  };
}
