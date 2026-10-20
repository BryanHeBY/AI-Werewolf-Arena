/**
 * 负责狼术师原生换位、夜目标映射回执及原体生命／窗口撤权。输入为原参与者与成对选择，
 * Camp 只在原字段点查询实际组件，名单保原值比较，不额外以同值新组件撤权。
 * 输出为当前映射、狼队就绪和关闭／中止结果；只有原绑定参与者共享交换，不替换来源。
 * 原状态与历史写入／身份编码归本族槽，frame 保原引用和 expectedState，并唯一拥有夜关系。
 * 历史先写、身份再刷新、pair／committed 最后提交；后续失败不退款、修复或覆盖已写前缀。
 */
import type { WolfSorcererReadState } from "@ai-werewolf-arena/game-contract";
import { resolveOrderedSeatTarget } from "./seat-mapping";
import { types } from "node:util";
import { hasValidOptionalPlayerName } from "../../domain/entities/player";
import { COMPONENT, type Camp, type RoleComponent, type World } from "../../domain";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../domain/components/alive";
import type { NightLifeScope } from "../../domain/night-effects";
import {
  getWolfSorcererState,
  projectWolfSorcererState,
  WOLF_SORCERER_ROLE,
  WOLF_SORCERER_STATE_SLOT,
} from "./state-slot";

interface OriginalPlayer {
  id: number;
  role: RoleComponent;
  roleName: RoleComponent["role"];
  camp: Camp | undefined;
  privateState: RoleComponent["privateState"];
  identity: unknown;
  seat: number;
  name: string | undefined;
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
  /** 原知识 JSON 检查点与同引用状态一起复验；不是库存副本或档案授权。 */
  expectedState: string;
  players: ReadonlyMap<number, OriginalPlayer>;
  night: ExchangeNight | null;
}
const boards = new WeakMap<World, Board>();
function ownData(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
function originalPlayer(world: World, p: OriginalPlayer): boolean {
  if (
    world.getComponent(p.id, COMPONENT.Role) !== p.role ||
    ownData(p.role, "role") !== p.roleName ||
    ownData(world.getComponent(p.id, COMPONENT.Camp), "camp") !== p.camp ||
    ownData(p.role, "privateState") !== p.privateState ||
    world.getComponent(p.id, COMPONENT.Identity) !== p.identity ||
    ownData(p.identity, "id") !== p.id ||
    ownData(p.identity, "seat") !== p.seat ||
    !hasValidOptionalPlayerName(p.identity) ||
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
  // 已提交换位保留原一次普通死亡效果；复活、换生命或原数据字段改为访问器仍撤权。
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
  if (
    getWolfSorcererState(actor.role, () => world.getComponent(actor.id, COMPONENT.Camp)) !==
      b.state ||
    WOLF_SORCERER_STATE_SLOT.checkpoint.identity(actor.role, () =>
      world.getComponent(actor.id, COMPONENT.Camp),
    ) !== b.expectedState
  )
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
      ownData(world.getComponent(id, COMPONENT.Camp), "camp") === undefined ||
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
      !hasValidOptionalPlayerName(identity) ||
      (name !== undefined && typeof name !== "string") ||
      typeof sessionId !== "string"
    )
      throw new Error("wolf_sorcerer_original_roster_invalid");
    seats.add(seat);
    players.set(id, {
      id,
      role,
      roleName: role.role,
      camp: world.getComponent(id, COMPONENT.Camp)?.camp,
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
      state = getWolfSorcererState(role, () => world.getComponent(id, COMPONENT.Camp));
    }
  }
  if (actorId === null || !state || state.history.length !== 0)
    throw new Error("wolf_sorcerer_original_roster_invalid");
  boards.set(world, {
    actorId,
    state,
    expectedState: WOLF_SORCERER_STATE_SLOT.checkpoint.identity(players.get(actorId)!.role, () =>
      world.getComponent(actorId, COMPONENT.Camp),
    ),
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
  for (const choice of projectWolfSorcererState(b.players.get(b.actorId)!.role, () =>
    world.getComponent(b.actorId, COMPONENT.Camp),
  )!.history)
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
  WOLF_SORCERER_STATE_SLOT.allowedWrites.appendHistory(() => b.state, day, chosen);
  b.expectedState = WOLF_SORCERER_STATE_SLOT.checkpoint.identity(b.players.get(actorId)!.role, () =>
    world.getComponent(actorId, COMPONENT.Camp),
  );
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

/** 仅清理原夜窗口；不校验／修复已撤权名单，不追加选择或重新取得资源。 */
export function abortWolfSorcererNight(world: World): void {
  const n = boards.get(world)?.night;
  if (n) n.closed = true;
}

/** 首次可行动的夜选择结算之前不公开初始狼队知识；知识就绪本身不授新请求许可。 */
export function wolfSorcererPackReady(world: World): boolean {
  const b = requireBoard(world),
    n = b.night;
  return !!n && n.day >= b.state.firstNight && n.committed;
}

export function wolfSorcererActorId(world: World): number {
  return requireBoard(world).actorId;
}
