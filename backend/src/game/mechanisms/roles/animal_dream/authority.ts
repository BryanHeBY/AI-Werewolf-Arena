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
  owners.set(world, { fox, puffer, cat, stopped: false, night: null, effect: null });
}
/** Reservation precedes the phase callback, so reentry or a failed callback never reopens this night. */
export function beginAnimalNight(world: World, day: number, isCurrent: () => boolean): void {
  const owner = currentOwner(world);
  if (
    !owner ||
    !Number.isSafeInteger(day) ||
    day !== (owner.night?.day ?? 0) + 1 ||
    (owner.night && owner.night.status !== "normal") ||
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
  };
}
