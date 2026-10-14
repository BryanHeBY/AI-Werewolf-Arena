/**
 * 负责蚀时狼妃原体与能力绑定、锁定夜窗口和反射回执。输入为原 World、选择与效果来源，
 * 输出为原有效目标、原生命 scope 和一次提交回执；close／abort 在原时点结束夜窗口。
 * 原字段、生命版本和能力政策复验不让复活／换体继承已付反射；已提交锁定允许一次普通死亡。
 * 状态槽拥有原数据写入和内部编码，frame 仍在原顺序拥有 used、revision、targetId／committed 及 expectedState。
 * 读取、写入或编码失败保留原前缀，不退款；回执及 scope 是运行引用，不是玩家 DTO 或独立授权。
 */
import type { TimeConsortReadState } from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import { COMPONENT, Camp, type RoleComponent, type World } from "../../../../core";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../../../core/domain/components/alive";
import type { NightLifeScope } from "../../../../core/domain/night_effects";
import { getTimeConsortState, projectTimeConsortState, TIME_CONSORT_ROLE, TIME_CONSORT_STATE_SLOT } from "./state-slot";

interface OriginalPlayer {
  abilityAuthority: () => boolean;
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
  targetId: number | null;
  revision: number;
  targets: ReadonlyMap<number, OriginalPlayer>;
}
interface Board {
  actorId: number;
  state: TimeConsortReadState;
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

const missingAbilityField = Symbol("missing_ability_field");
function boundAbilityData(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value))
    throw new Error("time_consort_original_abilities_invalid");
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) {
    if (key in value) throw new Error("time_consort_original_abilities_invalid");
    return missingAbilityField;
  }
  if (!("value" in descriptor)) throw new Error("time_consort_original_abilities_invalid");
  return descriptor.value;
}
function bindAbilities(role: RoleComponent): () => boolean {
  const container = boundAbilityData(role.privateState, "abilities");
  const prototype = Object.getPrototypeOf(role.privateState);
  if (container === missingAbilityField || container === undefined)
    return () =>
      Object.getPrototypeOf(role.privateState) === prototype &&
      boundAbilityData(role.privateState, "abilities") === container;
  if (
    !container ||
    typeof container !== "object" ||
    types.isProxy(container) ||
    Array.isArray(container)
  )
    throw new Error("time_consort_original_abilities_invalid");
  const names = Reflect.ownKeys(container);
  const bindings = names.map((key) => {
    const ability = ownData(container, key);
    if (!ability || typeof ability !== "object" || types.isProxy(ability))
      throw new Error("time_consort_original_abilities_invalid");
    const fields = [
      "id",
      "kind",
      "activation",
      "source",
      "state",
      "startsOnDay",
      "expiresAfterDay",
      "maxUses",
      "disabled",
      "deathExpired",
      "sourceDisclosed",
    ] as const;
    const values = fields.map((k) => boundAbilityData(ability, k)),
      source = ownData(ability, "source"),
      state = ownData(ability, "state");
    const sourceFields = ["kind", "role", "actorId", "abilityId"] as const,
      sourceValues = sourceFields.map((k) => boundAbilityData(source, k));
    const policyFields = [
        "targetPolicy",
        "actionPolicy",
        "selfHealRule",
        "knifeVisibility",
        "potionPolicy",
        "repeatPolicy",
      ] as const,
      policies = policyFields.map((k) => boundAbilityData(state, k));
    return () =>
      ownData(container, key) === ability &&
      fields.every((k, i) => boundAbilityData(ability, k) === values[i]) &&
      sourceFields.every((k, i) => boundAbilityData(source, k) === sourceValues[i]) &&
      policyFields.every((k, i) => boundAbilityData(state, k) === policies[i]);
  });
  return () =>
    Object.getPrototypeOf(role.privateState) === prototype &&
    boundAbilityData(role.privateState, "abilities") === container &&
    Reflect.ownKeys(container).length === names.length &&
    bindings.every((fn) => fn());
}

function originalPlayer(world: World, p: OriginalPlayer): boolean {
  if (
    !p.abilityAuthority() ||
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
  // 已提交锁定保留一次普通死亡的原生命版本前缀，不允许复活或换生命。
  return p.life.alive ? version === p.version : version === p.version + 1;
}
function requireBoard(world: World): Board {
  const b = boards.get(world);
  if (!b) throw new Error("time_consort_board_missing");
  const ids = world.entityIds();
  if (
    ids.length !== b.players.size ||
    ids.some((id) => !b.players.has(id)) ||
    [...b.players.values()].some((p) => !originalPlayer(world, p))
  )
    throw new Error("time_consort_original_state_revoked");
  const actor = b.players.get(b.actorId)!;
  if (getTimeConsortState(actor.role) !== b.state || TIME_CONSORT_STATE_SLOT.checkpoint.identity(actor.role) !== b.expectedState)
    throw new Error("time_consort_original_state_revoked");
  return b;
}
export function installTimeConsortBoard(world: World): void {
  if (boards.has(world)) throw new Error("time_consort_board_already_installed");
  const players = new Map<number, OriginalPlayer>();
  const seats = new Set<number>();
  let actorId: number | null = null;
  let state: TimeConsortReadState | undefined;
  for (const id of world.entityIds()) {
    const role = world.getComponent(id, COMPONENT.Role);
    const life = world.getComponent(id, COMPONENT.Alive);
    const version = life && aliveLifeVersion(life);
    if (!role || !life || types.isProxy(life) || version === undefined)
      throw new Error("time_consort_original_roster_invalid");
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
      throw new Error("time_consort_original_roster_invalid");
    if (
      ownData(role, "role") === undefined ||
      ownData(role, "camp") === undefined ||
      ownData(role, "privateState") === undefined
    )
      throw new Error("time_consort_original_roster_invalid");
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
      throw new Error("time_consort_original_roster_invalid");
    seats.add(seat);
    players.set(id, {
      abilityAuthority: bindAbilities(role),
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
    if (String(role.role) === TIME_CONSORT_ROLE) {
      if (actorId !== null) throw new Error("time_consort_original_roster_invalid");
      actorId = id;
      state = getTimeConsortState(role);
    }
  }
  if (actorId === null || !state || state.history.length !== 0 || state.triggeredDay !== null)
    throw new Error("time_consort_original_roster_invalid");
  boards.set(world, {
    actorId,
    state,
    expectedState: TIME_CONSORT_STATE_SLOT.checkpoint.identity(players.get(actorId)!.role),
    players,
    night: null,
  });
}
export function isTimeConsortBoard(world: World): boolean {
  if (!boards.has(world)) return false;
  requireBoard(world);
  return true;
}

export function beginTimeConsortNight(world: World, day: number): number | null {
  const b = requireBoard(world);
  if (
    !Number.isSafeInteger(day) ||
    day <= 0 ||
    day >= Number.MAX_SAFE_INTEGER ||
    (!b.night && day !== 1) ||
    (b.night && (!b.night.closed || day !== b.night.day + 1))
  )
    throw new Error("time_consort_night_invalid");
  const previous = projectTimeConsortState(b.players.get(b.actorId)!.role, day)!.history.at(-1);
  const targets = new Map(
    [...b.players].filter(
      ([id, p]) => p.life.alive && !(previous?.day === day - 1 && previous.targetId === id),
    ),
  );
  const eligible =
    b.players.get(b.actorId)!.life.alive && b.state.triggeredDay === null && targets.size > 0;
  b.night = { day, closed: false, committed: !eligible, targetId: null, targets, revision: 0 };
  return eligible ? b.actorId : null;
}
export function timeConsortChoiceTargets(world: World, day: number): number[] {
  const b = requireBoard(world),
    n = b.night;
  return !n || n.day !== day || n.closed || n.committed
    ? []
    : [...n.targets.values()].filter((p) => p.life.alive).map((p) => p.id);
}
export function commitTimeConsortChoice(
  world: World,
  actorId: number,
  day: number,
  targetId: number | null,
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
    throw new Error("time_consort_choice_scope_invalid");
  if (
    targetId !== null &&
    (!Number.isSafeInteger(targetId) || !n.targets.get(targetId)?.life.alive)
  )
    throw new Error("time_consort_choice_target_invalid");
  // 先追加历史，再依原顺序更新目标／提交标志／版本；编码失败不回滚已写前缀。
  TIME_CONSORT_STATE_SLOT.allowedWrites.appendHistory(() => b.state, day, targetId);
  n.targetId = targetId;
  n.committed = true;
  n.revision++;
  b.expectedState = TIME_CONSORT_STATE_SLOT.checkpoint.identity(b.players.get(actorId)!.role);
}
export interface TimeConsortReceipt {
  readonly requestedId: number;
  readonly effectiveId: number;
  readonly reflected: boolean;
  readonly scope: NightLifeScope;
  readonly isCurrent: () => boolean;
  readonly commit: () => void;
}
export function resolveTimeConsortTarget(
  world: World,
  day: number,
  sourceId: number,
  requestedId: number,
  kind: "check" | "guard" | "poison" | "heal" | "kill",
): TimeConsortReceipt {
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.day !== day || n.closed || !n.committed)
    throw new Error("time_consort_night_unsettled");
  const source = b.players.get(sourceId),
    requested = b.players.get(requestedId);
  if (!source?.life.alive || !requested?.life.alive) throw new Error("time_consort_target_invalid");
  const reflected =
    source.camp === Camp.Good &&
    ["check", "guard", "poison"].includes(kind) &&
    n.targetId === requestedId &&
    (b.state.triggeredDay === null ||
      (b.state.triggeredDay === day && b.state.reflectionScope === "whole_night"));
  const effective = reflected ? source : requested;
  const sourceVersion = aliveLifeVersion(source.life),
    requestedVersion = aliveLifeVersion(requested.life),
    revision = n.revision;
  const scope: NightLifeScope = Object.freeze({
    id: effective.id,
    life: effective.life,
    version: aliveLifeVersion(effective.life)!,
  });
  let used = false;
  const current = () => {
    try {
      return (
        !used &&
        requireBoard(world) === b &&
        b.night === n &&
        !n.closed &&
        n.committed &&
        n.revision === revision &&
        source.life.alive &&
        requested.life.alive &&
        effective.life.alive &&
        aliveLifeVersion(source.life) === sourceVersion &&
        aliveLifeVersion(requested.life) === requestedVersion &&
        aliveLifeVersion(effective.life) === scope.version
      );
    } catch {
      return false;
    }
  };
  return Object.freeze({
    requestedId,
    effectiveId: effective.id,
    reflected,
    scope,
    isCurrent: current,
    commit: () => {
      if (!current()) throw new Error("time_consort_receipt_stale");
      used = true;
      if (reflected) {
        // used 已消费；触发 setter 失败时不再重开回执，版本及编码仍在此写入之后。
        TIME_CONSORT_STATE_SLOT.allowedWrites.trigger(() => b.state, day);
        n.revision++;
        b.expectedState = TIME_CONSORT_STATE_SLOT.checkpoint.identity(b.players.get(b.actorId)!.role);
      }
    },
  });
}
export function closeTimeConsortNight(world: World, day: number): void {
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.day !== day || n.closed || !n.committed)
    throw new Error("time_consort_night_unsettled");
  n.closed = true;
}
export function abortTimeConsortNight(world: World): void {
  const n = boards.get(world)?.night;
  if (n) n.closed = true;
}
export function assertTimeConsortRosterCurrent(world: World): void {
  requireBoard(world);
}
export function timeConsortChoicePending(world: World, actorId: number, day: number): boolean {
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
export function timeConsortActorId(world: World): number | null {
  return boards.has(world) ? requireBoard(world).actorId : null;
}
