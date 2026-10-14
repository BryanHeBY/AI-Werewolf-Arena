/**
 * 负责明辉／黯月原阵容、吞噬借用租约及已付庇护／反噬效果的唯一权限。
 * 输入为当前能力原体和目标租约；输出为当次资格检查、封存夜效果与关闭事实。
 * 仅原匹配来源可以付款，借用关闭不恢复失效原体；payload、租约和原主抑制仍在此持有。
 * 公共 metadata 安装和退役写归共享实例 owner，原库存、抑制解除、生命校验和失败前缀不变。
 * 规则依据：docs/rules/awa-radiant-eclipse-twelve-v1.md。
 */
import { types } from "node:util";
import { COMPONENT } from "../../../../core/domain/components/names";
import { Role, Camp } from "../../../../core/domain/identity";
import type { RoleComponent } from "../../../../core/domain/components/role";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../../../core/domain/components/alive";
import type { World } from "../../../../core/domain/world";
import type { GameEvent } from "../../../../core/domain/events";
import {
  captureNightLife,
  type NightLifeScope,
  type NightImmunityClaim,
  type NightRadiantBacklash,
} from "../../../../core/domain/night_effects";
import { allNightAbilities, abilityStatus, type NightAbilityReadView } from "../abilities";
import { retireBorrowedNightAbility } from "../abilities";
import { grantNightAbility } from "../night-ability-grants";
import { openEclipseSuppression } from "./suppression";
import { snapshotBorrowedState, type BorrowedKind } from "./borrowed_state";
import type { EclipseState } from "@ai-werewolf-arena/game-contract/facts/radiant-eclipse";
import { readEclipseState, EclipseStateBinding } from "./eclipse-state-slot";
import { readShelterState } from "./shelter-state";

const invalid = Symbol("invalid_radiant_binding");
function own(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return invalid;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : d ? invalid : undefined;
}
function factoryLife(life: AliveComponent): boolean {
  if (types.isProxy(life)) return false;
  const a = aliveLifeDescriptor(life),
    b = Object.getOwnPropertyDescriptor(life, "alive");
  return (
    !!a &&
    !!b &&
    a.get === b.get &&
    a.set === b.set &&
    a.enumerable === b.enumerable &&
    a.configurable === b.configurable
  );
}
interface Original {
  id: number;
  role: RoleComponent;
  kind: Role;
  camp: Camp;
  privateState: RoleComponent["privateState"];
  identity: unknown;
  identityValues: unknown[];
  life: AliveComponent;
  version: number;
  campComponent: unknown;
  victory: unknown;
  container: unknown;
  native: NightAbilityReadView | undefined;
  nativeId: string | undefined;
  nativeKind: unknown;
  nativeState: unknown;
  nativeSource: unknown;
  nativeMetadata: readonly unknown[];
  nativePolicy: readonly unknown[];
}
interface BorrowLease {
  target: Original;
  native: NightAbilityReadView | undefined;
  borrowed: NightAbilityReadView | undefined;
  borrowedId: string | null;
  suppression: ReturnType<typeof openEclipseSuppression> | undefined;
}
interface Night {
  day: number;
  closed: boolean;
  status: "open" | "committed" | "aborted";
  living: ReadonlySet<number>;
  knife: boolean;
  swallowOpened: boolean;
  swallowed: boolean;
  targetId: number | null;
  lease: BorrowLease | undefined;
  shelters: Array<{
    actorId: number;
    abilityId: string;
    target: NightLifeScope;
    owner: () => boolean;
  }>;
  sourceChecks: Map<number, () => boolean>;
}
interface Board {
  players: ReadonlyMap<number, Original>;
  maidId: number;
  countId: number;
  knownWolves: readonly number[];
  // 原状态与归一化编码唯一归此绑定；名单、借用、付款与关闭仍归本 frame。
  eclipseState: EclipseStateBinding;
  allowed: Map<number, Map<string, NightAbilityReadView>>;
  night: Night | null;
}
const boards = new WeakMap<World, Board>();
const nativeKeys = [
  "id",
  "kind",
  "activation",
  "startsOnDay",
  "expiresAfterDay",
  "maxUses",
  "sourceDisclosed",
] as const;
const policyKeys = [
  "policy",
  "targetPolicy",
  "actionPolicy",
  "selfHealRule",
  "knifeVisibility",
  "potionPolicy",
  "protectionPolicy",
] as const;
const identityKeys = ["id", "seat", "name", "sessionId"] as const;
function original(world: World, id: number): Original {
  const role = world.getComponent(id, COMPONENT.Role)!;
  const life = world.getComponent(id, COMPONENT.Alive)!;
  const identity = world.getComponent(id, COMPONENT.Identity);
  if (!role || !life || !factoryLife(life) || !life.alive || aliveLifeVersion(life) === undefined)
    throw new Error("radiant_original_invalid");
  const native = allNightAbilities(role).filter((a) => a.source.kind === "native");
  if (native.length > 1 || allNightAbilities(role).length !== native.length)
    throw new Error("radiant_original_abilities_invalid");
  return {
    id,
    role,
    kind: role.role,
    camp: role.camp,
    privateState: role.privateState,
    identity,
    identityValues: identityKeys.map((k) => own(identity, k)),
    life,
    version: aliveLifeVersion(life)!,
    campComponent: world.getComponent(id, COMPONENT.Camp),
    victory: world.getComponent(id, COMPONENT.Victory),
    container: own(role.privateState, "abilities"),
    native: native[0],
    nativeId: native[0]?.id,
    nativeKind: native[0]?.kind,
    nativeState: native[0]?.state,
    nativeSource: native[0]?.source,
    nativeMetadata: nativeKeys.map((key) => own(native[0], key)),
    nativePolicy: policyKeys.map((key) => own(native[0]?.state, key)),
  };
}
function current(world: World, p: Original, allowDeath = true): boolean {
  if (
    world.getComponent(p.id, COMPONENT.Role) !== p.role ||
    own(p.role, "role") !== p.kind ||
    own(p.role, "camp") !== p.camp ||
    own(p.role, "privateState") !== p.privateState ||
    world.getComponent(p.id, COMPONENT.Identity) !== p.identity ||
    !identityKeys.every((k, i) => own(p.identity, k) === p.identityValues[i]) ||
    world.getComponent(p.id, COMPONENT.Camp) !== p.campComponent ||
    own(p.campComponent, "camp") !== p.camp ||
    world.getComponent(p.id, COMPONENT.Victory) !== p.victory ||
    world.getComponent(p.id, COMPONENT.Alive) !== p.life ||
    !factoryLife(p.life) ||
    own(p.privateState, "abilities") !== p.container
  )
    return false;
  const v = aliveLifeVersion(p.life);
  return p.life.alive ? v === p.version : allowDeath && v === p.version + 1;
}
function requireBoard(world: World): Board {
  const b = boards.get(world);
  if (!b) throw new Error("radiant_board_missing");
  if (
    world.entityIds().length !== b.players.size ||
    [...b.players.values()].some((p) => !current(world, p))
  )
    throw new Error("radiant_roster_revoked");
  for (const p of b.players.values()) {
    originalAbility(p);
    const allowed = b.allowed.get(p.id)!;
    const container = own(p.privateState, "abilities");
    const keys = container === undefined ? [] : Reflect.ownKeys(container as object);
    if (
      keys.length !== allowed.size ||
      keys.some(
        (key) =>
          typeof key !== "string" || !allowed.has(key) || own(container, key) !== allowed.get(key),
      )
    )
      throw new Error("radiant_ability_membership_revoked");
  }
  b.eclipseState.assertCurrent(() => own(b.players.get(b.maidId)!.privateState, "eclipse"));
  return b;
}
function requireNight(world: World, day: number): { b: Board; n: Night } {
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.day !== day || n.closed) throw new Error("radiant_night_unavailable");
  return { b, n };
}
function originalAbility(p: Original): NightAbilityReadView | undefined {
  const a = p.native;
  if (!a) return undefined;
  if (
    own(p.container, p.nativeId!) !== a ||
    own(a, "id") !== p.nativeId ||
    own(a, "kind") !== p.nativeKind ||
    own(a, "state") !== p.nativeState ||
    own(a, "source") !== p.nativeSource ||
    own(p.nativeSource, "kind") !== "native" ||
    own(p.nativeSource, "role") !== p.kind ||
    own(a, "activation") !== undefined ||
    !nativeKeys.every((key, i) => own(a, key) === p.nativeMetadata[i]) ||
    !policyKeys.every((key, i) => own(p.nativeState, key) === p.nativePolicy[i])
  )
    throw new Error("radiant_original_ability_revoked");
  return a;
}
function stateGuard(a: NightAbilityReadView): () => boolean {
  const state = own(a, "state") as NightAbilityReadView["state"],
    source = own(a, "source") as NightAbilityReadView["source"];
  if (
    !state ||
    !source ||
    types.isProxy(state) ||
    types.isProxy(source) ||
    typeof state !== "object" ||
    typeof source !== "object"
  )
    throw new Error("radiant_ability_state_invalid");
  const fields = [
    "id",
    "kind",
    "activation",
    "startsOnDay",
    "expiresAfterDay",
    "maxUses",
    "uses",
    "lastUsedDay",
    "disabled",
    "deathExpired",
    "sourceDisclosed",
  ] as const;
  const values = fields.map((k) => own(a, k));
  const sourceKeys = ["kind", "role", "actorId", "abilityId"] as const,
    sourceValues = sourceKeys.map((k) => own(source, k));
  const keys = Reflect.ownKeys(state),
    valuesState = keys.map((k) => own(state, k));
  if (values.includes(invalid) || sourceValues.includes(invalid) || valuesState.includes(invalid))
    throw new Error("radiant_ability_state_invalid");
  const arrays = valuesState.filter(Array.isArray).map((array) => {
    if (types.isProxy(array)) throw new Error("radiant_ability_state_invalid");
    return { array, length: own(array, "length") };
  });
  return () =>
    own(a, "state") === state &&
    own(a, "source") === source &&
    fields.every((k, i) => own(a, k) === values[i]) &&
    sourceKeys.every((k, i) => own(source, k) === sourceValues[i]) &&
    Reflect.ownKeys(state).length === keys.length &&
    keys.every((k, i) => own(state, k) === valuesState[i]) &&
    arrays.every(({ array, length }) => own(array, "length") === length);
}
export function installRadiantEclipseBoard(world: World) {
  if (boards.has(world)) throw new Error("radiant_board_already_installed");
  const players = new Map(world.entityIds().map((id) => [id, original(world, id)]));
  const maid = [...players.values()].filter((p) => p.kind === Role.EclipseMaid),
    count = [...players.values()].filter((p) => p.kind === Role.RadiantCount);
  if (players.size !== 12 || maid.length !== 1 || count.length !== 1)
    throw new Error("radiant_roster_invalid");
  const state = own(maid[0]!.privateState, "eclipse"),
    parsed = readEclipseState(state);
  if (!parsed || parsed.history.length !== 0) throw new Error("eclipse_initial_state_invalid");
  boards.set(world, {
    players,
    maidId: maid[0]!.id,
    countId: count[0]!.id,
    knownWolves: Object.freeze(
      [...players.values()].filter((p) => p.kind === Role.Wolf).map((p) => p.id),
    ),
    eclipseState: new EclipseStateBinding(state as EclipseState, parsed),
    night: null,
    allowed: new Map(
      [...players.values()].map((p) => [
        p.id,
        new Map(allNightAbilities(p.role).map((a) => [a.id, a])),
      ]),
    ),
  });
}
export const isRadiantEclipseBoard = (world: World) => boards.has(world);
export const hasRadiantNight = (world: World, day: number) => boards.get(world)?.night?.day === day;
export function assertRadiantRosterCurrent(world: World) {
  if (boards.has(world)) requireBoard(world);
}
export function beginRadiantNight(world: World, day: number) {
  const b = requireBoard(world);
  if (!Number.isSafeInteger(day) || day < 1 || (b.night && (day <= b.night.day || !b.night.closed)))
    throw new Error("radiant_night_reentry");
  const living = new Set([...b.players.values()].filter((p) => p.life.alive).map((p) => p.id));
  b.night = {
    day,
    closed: false,
    status: "open",
    living,
    knife: living.has(b.maidId) && b.knownWolves.every((id) => !living.has(id)),
    swallowOpened: false,
    swallowed: false,
    targetId: null,
    lease: undefined,
    shelters: [],
    sourceChecks: new Map(),
  };
}
export function eclipseKnownWolves(world: World): readonly number[] {
  return boards.has(world) ? requireBoard(world).knownWolves : [];
}
export function eclipseKnifeEligible(world: World): boolean {
  const b = boards.get(world);
  return (
    !!b &&
    !!b.night &&
    !b.night.closed &&
    b.night.knife &&
    current(world, b.players.get(b.maidId)!, false)
  );
}
export function eclipseSwallowTargets(world: World, day: number): number[] {
  const { b, n } = requireNight(world, day);
  if (day < 2 || !n.living.has(b.maidId) || n.swallowed) return [];
  const last = b.eclipseState.lastChoice();
  return [...b.players.values()]
    .filter(
      (p) =>
        p.camp === Camp.Good && p.life.alive && (last?.day !== day - 1 || last.targetId !== p.id),
    )
    .map((p) => p.id);
}
export function eclipseChoiceEligible(world: World, day: number, actorId: number): boolean {
  try {
    const { b, n } = requireNight(world, day);
    return (
      day >= 2 &&
      actorId === b.maidId &&
      current(world, b.players.get(actorId)!, false) &&
      n.swallowOpened &&
      !n.swallowed
    );
  } catch {
    return false;
  }
}
export function openEclipseChoice(world: World, day: number) {
  const { b, n } = requireNight(world, day);
  if (n.swallowOpened || day < 2) throw new Error("eclipse_choice_reentry");
  n.swallowOpened = true;
  for (const id of eclipseSwallowTargets(world, day)) {
    const p = b.players.get(id)!,
      a = originalAbility(p);
    if (a) n.sourceChecks.set(id, stateGuard(a));
  }
}
export function commitEclipseChoice(
  world: World,
  day: number,
  targetId: number | null,
  events: GameEvent[],
) {
  const { b, n } = requireNight(world, day);
  if (!n.swallowOpened || n.swallowed) throw new Error("eclipse_choice_unavailable");
  const maid = b.players.get(b.maidId)!;
  if (
    !current(world, maid, false) ||
    (targetId !== null && !eclipseSwallowTargets(world, day).includes(targetId))
  )
    throw new Error("eclipse_choice_target");
  const target = targetId === null ? undefined : b.players.get(targetId)!;
  const a = target && originalAbility(target);
  if (
    target &&
    (!current(world, target, false) ||
      (a && (!n.sourceChecks.get(target.id)?.() || abilityStatus(a, day) !== "active")))
  )
    throw new Error("eclipse_choice_source_revoked");
  const roleId = target?.kind ?? null;
  const next = b.eclipseState.next(day, targetId, () => eclipseSwallowTargets(world, day), roleId);
  let suppression: BorrowLease["suppression"], borrowed: NightAbilityReadView | undefined;
  if (a && target) {
    const kind = a.kind as BorrowedKind;
    if (!["seer_check", "potion", "dream", "shelter"].includes(kind))
      throw new Error("eclipse_borrow_kind_invalid");
    const state = snapshotBorrowedState(kind, a.state, day);
    suppression = openEclipseSuppression(world, target.id, a, day);
    try {
      borrowed = grantNightAbility(
        world,
        b.maidId,
        {
          id: `copy:eclipse:night:${day}`,
          kind,
          state,
          source: { kind: "copy", actorId: target.id, abilityId: a.id },
          sourceDisclosed: true,
          startsOnDay: day,
          expiresAfterDay: day,
          maxUses: null,
        },
        events,
      );
    } catch (error) {
      suppression.close();
      throw error;
    }
  }
  if (borrowed) b.allowed.get(b.maidId)!.set(borrowed.id, borrowed);
  // 原借用／allowed已提交；数据部分写失败仍保此前前缀，成功之后才写本夜完成与lease。
  b.eclipseState.install(next);
  n.swallowed = true;
  n.targetId = targetId;
  n.lease = target
    ? { target, native: a, borrowed, borrowedId: borrowed?.id ?? null, suppression }
    : undefined;
  events.push({
    timestamp: Date.now(),
    type: "eclipse_swallowed",
    payload: { actorId: b.maidId, day, targetId, roleId, abilityId: borrowed?.id ?? null },
    audience: Object.freeze([b.maidId]),
  });
  if (target)
    events.push({
      timestamp: Date.now(),
      type: "eclipse_native_suppressed",
      payload: { playerId: target.id, day },
      audience: Object.freeze([target.id]),
    });
}
export function shelterTargets(
  world: World,
  day: number,
  actorId: number,
  abilityId: string,
): number[] {
  const { b, n } = requireNight(world, day),
    p = b.players.get(actorId);
  if (day < 2 || !p || !p.life.alive) return [];
  const a = allNightAbilities(p.role).find((a) => a.id === abilityId && a.kind === "shelter");
  if (!a || a.kind !== "shelter" || abilityStatus(a, day) !== "active") return [];
  const s = readShelterState(a.state);
  if (!s) throw new Error("radiant_shelter_state_invalid");
  if (actorId === b.countId && a !== p.native) return [];
  if (actorId !== b.countId && (actorId !== b.maidId || n.lease?.borrowed !== a)) return [];
  return [...b.players.values()]
    .filter(
      (p) => p.life.alive && p.id !== actorId && !(s.lastDay === day - 1 && s.lastTarget === p.id),
    )
    .map((p) => p.id);
}
export function captureRadiantTurn(
  world: World,
  actorId: number,
  ability: NightAbilityReadView,
  day: number,
): () => boolean {
  if (!boards.has(world)) return () => true;
  const { b, n } = requireNight(world, day),
    p = b.players.get(actorId);
  if (!p || !current(world, p, false) || own(p.container, ability.id) !== ability)
    throw new Error("radiant_turn_owner_invalid");
  if (ability !== p.native && n.lease?.borrowed !== ability)
    throw new Error("radiant_turn_instance_invalid");
  const capturedId = ability.id;
  const guard = stateGuard(ability),
    source = n.lease?.borrowed === ability ? n.lease : undefined;
  return () =>
    !n.closed &&
    b.night === n &&
    current(world, p, false) &&
    own(p.container, capturedId) === ability &&
    guard() &&
    (!source ||
      (current(world, source.target, false) &&
        source.suppression?.isCurrent() === true &&
        n.sourceChecks.get(source.target.id)?.() === true));
}
/** Paid effects bind bodies and resources independently of a closed action permit. */
export function captureRadiantPaidEffect(
  world: World,
  day: number,
  actorId: number,
  ability: NightAbilityReadView,
  targetId: number,
): (() => boolean) | undefined {
  if (!boards.has(world)) return undefined;
  const { b, n } = requireNight(world, day),
    actor = b.players.get(actorId)!,
    target = b.players.get(targetId)!;
  const id = own(ability, "id"),
    kind = own(ability, "kind"),
    state = own(ability, "state"),
    source = own(ability, "source");
  const sourceKeys = ["kind", "role", "actorId", "abilityId"] as const,
    sourceValues = sourceKeys.map((key) => own(source, key));
  return () =>
    b.night === n &&
    n.status !== "aborted" &&
    current(world, actor) &&
    current(world, target) &&
    own(actor.container, id as string) === ability &&
    own(ability, "id") === id &&
    own(ability, "kind") === kind &&
    own(ability, "state") === state &&
    own(ability, "source") === source &&
    sourceKeys.every((key, i) => own(source, key) === sourceValues[i]);
}
export function commitRadiantShelter(
  world: World,
  day: number,
  actorId: number,
  ability: NightAbilityReadView<"shelter">,
  targetId: number | null,
  events: GameEvent[],
) {
  const { b, n } = requireNight(world, day),
    p = b.players.get(actorId)!;
  if (!p) throw new Error("radiant_shelter_actor_invalid");
  if (targetId !== null) {
    const target = captureNightLife(world, targetId);
    if (!target) throw new Error("radiant_shelter_target_revoked");
    const id = ability.id;
    const owner = captureRadiantPaidEffect(world, day, actorId, ability, targetId)!;
    n.shelters.push({ actorId, abilityId: id, target, owner });
  }
  events.push({
    timestamp: Date.now(),
    type: "radiant_shelter_chosen",
    payload: { actorId, day, targetId, abilityId: ability.id },
    audience: Object.freeze([actorId]),
  });
}
export function sealRadiantNightEffects(
  world: World,
  day: number,
): { shelters: readonly NightImmunityClaim[]; backlashes: readonly NightRadiantBacklash[] } {
  const { b, n } = requireNight(world, day);
  const shelters = Object.freeze(
    n.shelters.map((s) =>
      Object.freeze({ target: Object.freeze({ ...s.target }), isCurrent: s.owner }),
    ),
  );
  const target = n.lease?.target;
  const triggered =
    target &&
    (target.id === b.countId || n.shelters.some((s) => s.target.id === target.id && s.owner()));
  const maid = b.players.get(b.maidId)!;
  const maidLife = triggered ? captureNightLife(world, b.maidId) : null;
  const backlashes = maidLife
    ? [
        {
          target: Object.freeze(maidLife),
          isCurrent: () => b.night === n && n.status !== "aborted" && current(world, maid),
        },
      ]
    : [];
  if (triggered && !maidLife) throw new Error("radiant_backlash_owner_revoked");
  return Object.freeze({
    shelters,
    backlashes: Object.freeze(backlashes.map((claim) => Object.freeze(claim))),
  });
}
export function closeRadiantNight(
  world: World,
  day: number,
  status: "committed" | "aborted",
  events: GameEvent[],
) {
  const b = boards.get(world),
    n = b?.night;
  if (!b || !n || n.day !== day || n.closed) return;
  n.closed = true;
  n.status = status;
  const l = n.lease;
  const restored = l?.suppression?.close() ?? l?.native === undefined;
  const maid = b.players.get(b.maidId)!;
  if (
    l?.borrowed &&
    world.getComponent(b.maidId, COMPONENT.Role) === maid.role &&
    own(maid.role, "privateState") === maid.privateState &&
    own(maid.privateState, "abilities") === maid.container &&
    world.getComponent(b.maidId, COMPONENT.Alive) === maid.life &&
    factoryLife(maid.life) &&
    (maid.life.alive
      ? aliveLifeVersion(maid.life) === maid.version
      : aliveLifeVersion(maid.life) === maid.version + 1) &&
    own(maid.container, l.borrowedId!) === l.borrowed
  )
    // 原主抑制的关闭尝试已先执行；只退役原女仆生命／捕获槽实例，保方法查找后才读取 l.borrowed。
    retireBorrowedNightAbility(() => l.borrowed!);
  events.push({
    timestamp: Date.now(),
    type: "eclipse_lease_closed",
    payload: {
      actorId: b.maidId,
      day,
      targetId: n.targetId,
      abilityId: l?.borrowedId ?? null,
      status,
    },
    audience: Object.freeze([]),
  });
  if (
    status === "committed" &&
    restored &&
    l?.target &&
    current(world, l.target) &&
    l.target.life.alive
  )
    events.push({
      timestamp: Date.now(),
      type: "eclipse_native_restored",
      payload: { playerId: l.target.id, day },
      audience: Object.freeze([l.target.id]),
    });
}
