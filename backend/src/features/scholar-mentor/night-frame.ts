/**
 * 负责白昼学者／寂夜导师的原 roster、生命／原生能力权威、夜选择许可和已结算加成。
 * 输入为原 World／day、选择与原生目标证据；输出保原 pending／selection、加成回执及有来源冲突死亡。
 * 状态 raw／库存／历史／JSON 绑定及实际数据写归本族 state-slot，有限板免疫与碰撞规则归 rules。
 * 不变量：槽提交成功才删 pending／追加 selection；普通已提交交换可跨一次正常死亡，不可跨复活或换生命。
 * 关闭仍要求原加成全处理，abort 只改原夜窗口；不为替换原体补授库存或复制运行回执。
 * 当前 Camp 在原字段点由实际 World 查询；保原值比较，不把同值组件替换改成新的引用撤权。
 */
import type {
  ModifierMode,
  CommittedModifier,
  ModifierResolution,
  ModifierReadState,
} from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import { COMPONENT, Camp, type RoleComponent, type World } from "../../domain";
import {
  aliveLifeDescriptor,
  aliveLifeVersion,
  type AliveComponent,
} from "../../domain/components/alive";
import type { NightLifeScope } from "../../domain/night-effects";
import {
  readModifierState,
  selectModifier,
  modifierOwnData as ownData,
  ScholarMentorStateSlot,
} from "./state-slot";
import { resolveModifiers } from "./rules";
// 原体／身份／生命与原生能力查询分开捕获；库存槽内容相同不能补回另一 Role 或生命的授权。
interface OriginalPlayer {
  abilityAuthority: () => boolean;
  id: number;
  role: RoleComponent;
  roleName: RoleComponent["role"];
  camp: Camp | undefined;
  privateState: RoleComponent["privateState"];
  identity: unknown;
  seat: number;
  name: string;
  sessionId: string;
  life: AliveComponent;
  version: number;
}
export type ModifierBonusKind = "check" | "guard" | "poison" | "kill";
// 本夜额外机会不扣施法者槽的另一份库存；used／targetId 在原创建点或复验后的回执 commit 才写。
interface Grant {
  actorId: number;
  kind: ModifierBonusKind;
  used: boolean;
  targetId: number | null;
}
// pending 保未提交选择，selections 仅在槽写与 JSON 更新成功后追加；两者与 bonus grant 生命周期仍归 frame。
interface ModifierNight {
  day: number;
  closed: boolean;
  aborted: boolean;
  living: ReadonlySet<number>;
  pending: Set<number>;
  selections: CommittedModifier[];
  resolution: ModifierResolution | null;
  grants: Map<number, Grant>;
  nativeTargets: Map<string, number | null>;
}
interface Board {
  players: ReadonlyMap<number, OriginalPlayer>;
  casters: ReadonlyMap<number, ScholarMentorStateSlot>;
  night: ModifierNight | null;
}
const boards = new WeakMap<World, Board>();


const missingAbilityField = Symbol("missing_ability_field");
function boundAbilityData(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value))
    throw new Error("scholar_mentor_original_abilities_invalid");
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) {
    if (key in value) throw new Error("scholar_mentor_original_abilities_invalid");
    return missingAbilityField;
  }
  if (!("value" in descriptor)) throw new Error("scholar_mentor_original_abilities_invalid");
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
    throw new Error("scholar_mentor_original_abilities_invalid");
  const names = Reflect.ownKeys(container);
  const bindings = names.map((key) => {
    const ability = ownData(container, key);
    if (!ability || typeof ability !== "object" || types.isProxy(ability))
      throw new Error("scholar_mentor_original_abilities_invalid");
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
    ownData(world.getComponent(p.id, COMPONENT.Camp), "camp") !== p.camp ||
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
  // 已提交交换可跨一次普通死亡；复活或换生命仍撤权。
  return p.life.alive ? version === p.version : version === p.version + 1;
}

function requireBoard(world: World): Board {
  const b = boards.get(world);
  if (!b) throw new Error("scholar_mentor_board_missing");
  const ids = world.entityIds();
  if (
    ids.length !== b.players.size ||
    ids.some((id) => !b.players.has(id)) ||
    [...b.players.values()].some((p) => !originalPlayer(world, p))
  )
    throw new Error("scholar_mentor_original_state_revoked");
  for (const [id, c] of b.casters) {
    if (
      !c.matches(ownData(b.players.get(id)!.privateState, "scholarMentor"))
    )
      throw new Error("scholar_mentor_original_state_revoked");
  }
  return b;
}
export function installScholarMentorBoard(world: World): void {
  if (boards.has(world)) throw new Error("scholar_mentor_board_already_installed");
  const players = new Map<number, OriginalPlayer>(),
    seats = new Set<number>();
  const casters = new Map<number, ScholarMentorStateSlot>();
  for (const id of world.entityIds()) {
    const role = world.getComponent(id, COMPONENT.Role);
    const life = world.getComponent(id, COMPONENT.Alive);
    const version = life && aliveLifeVersion(life);
    if (
      !role ||
      !life ||
      types.isProxy(life) ||
      version === undefined ||
      (world.getComponent(id, COMPONENT.Camp)?.camp !== Camp.Wolf && world.getComponent(id, COMPONENT.Camp)?.camp !== Camp.Good)
    )
      throw new Error("scholar_mentor_original_roster_invalid");
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
      throw new Error("scholar_mentor_original_roster_invalid");
    if (
      ownData(role, "role") === undefined ||
      ownData(world.getComponent(id, COMPONENT.Camp), "camp") === undefined ||
      ownData(role, "privateState") === undefined
    )
      throw new Error("scholar_mentor_original_roster_invalid");
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
      throw new Error("scholar_mentor_original_roster_invalid");
    seats.add(seat);
    players.set(id, {
      abilityAuthority: bindAbilities(role),
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

    if (String(role.role) === "day_scholar" || String(role.role) === "night_mentor") {
      const raw = ownData(role.privateState, "scholarMentor");
      const state = readModifierState(raw);
      if (!state || state.caster !== String(role.role) || state.history.length !== 0)
        throw new Error("scholar_mentor_original_roster_invalid");
      const original = raw as ModifierReadState;
      casters.set(id, new ScholarMentorStateSlot(original));
    }
  }
  resolveModifiers(
    [...players.values()].map((p) => ({
      id: p.id,
      role: String(p.roleName),
      camp: p.camp === Camp.Wolf ? "wolf" : "good",
      alive: true,
    })),
    [],
  );
  if (casters.size !== 2) throw new Error("scholar_mentor_original_roster_invalid");
  boards.set(world, { players, casters, night: null });
}
export function isScholarMentorBoard(world: World): boolean {
  if (!boards.has(world)) return false;
  requireBoard(world);
  return true;
}
export function assertScholarMentorRosterCurrent(world: World): void {
  if (boards.has(world)) requireBoard(world);
}
function night(world: World, day: number): { b: Board; n: ModifierNight } {
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.day !== day || n.closed || n.aborted)
    throw new Error("scholar_mentor_night_unavailable");
  return { b, n };
}
function resolved(
  world: World,
  day: number,
): { b: Board; n: ModifierNight; r: ModifierResolution } {
  const { b, n } = night(world, day);
  if (!n.resolution) throw new Error("scholar_mentor_night_unsettled");
  return { b, n, r: n.resolution };
}
export function beginScholarMentorNight(world: World, day: number): number[] {
  const b = requireBoard(world);
  if (
    !Number.isSafeInteger(day) ||
    day < 1 ||
    day >= Number.MAX_SAFE_INTEGER ||
    (!b.night && day !== 1) ||
    (b.night && (!b.night.closed || b.night.aborted || day !== b.night.day + 1))
  )
    throw new Error("scholar_mentor_night_invalid");
  const living = new Set([...b.players.values()].filter((p) => p.life.alive).map((p) => p.id));
  const pending = new Set(
    [...b.casters]
      .filter(
        ([id, c]) =>
          day >= 2 && living.has(id) && c.state.remaining.enhance + c.state.remaining.weaken > 0,
      )
      .map(([id]) => id),
  );
  b.night = {
    day,
    closed: false,
    aborted: false,
    living,
    pending,
    selections: [],
    resolution: null,
    grants: new Map(),
    nativeTargets: new Map(),
  };
  return [...pending];
}
export function scholarMentorChoicePending(world: World, day: number, actorId: number): boolean {
  const { b, n } = night(world, day);
  return n.pending.has(actorId) && b.players.get(actorId)!.life.alive;
}
export function scholarMentorChoiceTargets(world: World, day: number, actorId: number): number[] {
  const { b, n } = night(world, day);
  return n.pending.has(actorId) ? [...n.living].filter((id) => b.players.get(id)!.life.alive) : [];
}
export function commitScholarMentorChoice(
  world: World,
  day: number,
  actorId: number,
  mode: ModifierMode | null,
  targetId: number | null,
): void {
  const { b, n } = night(world, day),
    c = b.casters.get(actorId);
  if (!c || !n.pending.has(actorId) || !b.players.get(actorId)!.life.alive || n.resolution)
    throw new Error("scholar_mentor_choice_scope_invalid");
  const next = selectModifier(
    c.state,
    day,
    mode,
    targetId,
    scholarMentorChoiceTargets(world, day, actorId),
  );
  c.commit(next);
  n.pending.delete(actorId);
  if (mode !== null)
    n.selections.push({ actorId, caster: c.state.caster, mode, targetId: targetId! });
}
export function settleScholarMentorChoices(world: World, day: number): ModifierResolution {
  const { b, n } = night(world, day);
  if (n.pending.size || n.resolution) throw new Error("scholar_mentor_choices_unsettled");
  const r = resolveModifiers(
    [...b.players.values()].map((p) => ({
      id: p.id,
      role: String(p.roleName),
      camp: p.camp === Camp.Wolf ? "wolf" : "good",
      alive: n.living.has(p.id),
    })),
    n.selections,
  );
  n.resolution = r;
  for (const effect of r.goodEffects)
    if (effect.mode === "enhance")
      n.grants.set(effect.targetId, {
        actorId: effect.targetId,
        kind: effect.role === "seer" ? "check" : effect.role === "witch" ? "poison" : "guard",
        used: false,
        targetId: null,
      });
  if (r.bonusKnifeActorId !== null)
    n.grants.set(r.bonusKnifeActorId, {
      actorId: r.bonusKnifeActorId,
      kind: "kill",
      used: false,
      targetId: null,
    });
  return structuredClone(r);
}
export function scholarMentorBlocks(
  world: World,
  day: number,
  actorId: number,
  kind: ModifierBonusKind,
): boolean {
  if (!boards.has(world)) return false;
  const { r } = resolved(world, day);
  if (kind === "kill") return r.blockWolfKnife;
  return r.goodEffects.some(
    (e) =>
      e.targetId === actorId &&
      e.mode === "weaken" &&
      ((e.role === "seer" && kind === "check") ||
        (e.role === "guard" && kind === "guard") ||
        (e.role === "witch" && kind === "poison")),
  );
}
export function scholarMentorKnifeEligible(world: World, day: number, actorId: number): boolean {
  const { b, n } = night(world, day),
    p = b.players.get(actorId);
  if (!p || !n.living.has(actorId) || !p.life.alive || p.camp !== Camp.Wolf) return false;
  if (String(p.roleName) === "wolf") return true;
  return (
    String(p.roleName) === "night_mentor" &&
    [...n.living].filter((id) => b.players.get(id)!.camp === Camp.Wolf).length === 1
  );
}
function nativeKey(actorId: number, kind: ModifierBonusKind): string {
  return kind === "kill" ? "pack:kill" : actorId + ":" + kind;
}
export function recordScholarMentorNativeTarget(
  world: World,
  day: number,
  actorId: number,
  kind: ModifierBonusKind,
  targetId: number | null,
): void {
  const { b, n } = resolved(world, day),
    key = nativeKey(actorId, kind),
    p = b.players.get(actorId);
  if (
    !p ||
    !n.living.has(actorId) ||
    !p.life.alive ||
    n.nativeTargets.has(key) ||
    (targetId !== null && (!n.living.has(targetId) || !b.players.get(targetId)?.life.alive))
  )
    throw new Error("scholar_mentor_native_target_invalid");
  const expected =
    kind === "check" ? "seer" : kind === "guard" ? "guard" : kind === "poison" ? "witch" : null;
  if (expected ? String(p.roleName) !== expected : !scholarMentorKnifeEligible(world, day, actorId))
    throw new Error("scholar_mentor_native_actor_invalid");
  n.nativeTargets.set(key, targetId);
}
export function scholarMentorBonusActors(
  world: World,
  day: number,
  kind: ModifierBonusKind,
): number[] {
  const { n } = resolved(world, day);
  return [...n.grants.values()].filter((g) => g.kind === kind && !g.used).map((g) => g.actorId);
}
export function scholarMentorBonusTargets(
  world: World,
  day: number,
  actorId: number,
  kind: ModifierBonusKind,
): number[] {
  const { b, n } = resolved(world, day),
    g = n.grants.get(actorId),
    key = nativeKey(actorId, kind);
  if (
    !g ||
    g.kind !== kind ||
    g.used ||
    !b.players.get(actorId)!.life.alive ||
    !n.nativeTargets.has(key)
  )
    return [];
  const native = n.nativeTargets.get(key);
  return [...n.living].filter((id) => id !== native && b.players.get(id)!.life.alive);
}
export interface ModifierBonusReceipt {
  readonly target: NightLifeScope | null;
  readonly source: NightLifeScope;
  readonly isCurrent: () => boolean;
  readonly effectCurrent: () => boolean;
  readonly commit: () => void;
}
export function captureScholarMentorBonus(
  world: World,
  day: number,
  actorId: number,
  kind: ModifierBonusKind,
  targetId: number | null,
): ModifierBonusReceipt {
  const { b, n } = resolved(world, day),
    g = n.grants.get(actorId),
    p = b.players.get(actorId),
    key = nativeKey(actorId, kind);
  if (
    !g ||
    g.kind !== kind ||
    g.used ||
    !p?.life.alive ||
    !n.nativeTargets.has(key) ||
    (targetId !== null && !scholarMentorBonusTargets(world, day, actorId, kind).includes(targetId))
  )
    throw new Error("scholar_mentor_bonus_unavailable");
  const source: NightLifeScope = Object.freeze({
    id: actorId,
    life: p.life,
    version: aliveLifeVersion(p.life)!,
  });
  const t = targetId === null ? null : b.players.get(targetId)!;
  const target: NightLifeScope | null = t
    ? Object.freeze({ id: t.id, life: t.life, version: aliveLifeVersion(t.life)! })
    : null;
  let committed = false;
  const live = () => {
    try {
      return (
        requireBoard(world) === b &&
        b.night === n &&
        !n.closed &&
        !n.aborted &&
        n.grants.get(actorId) === g &&
        p.life.alive &&
        aliveLifeVersion(p.life) === source.version &&
        (!target || (target.life.alive && aliveLifeVersion(target.life) === target.version))
      );
    } catch {
      return false;
    }
  };
  const isCurrent = () => !committed && !g.used && live();
  return Object.freeze({
    source,
    target,
    isCurrent,
    effectCurrent: () => committed && g.used && g.targetId === targetId && live(),
    commit: () => {
      if (!isCurrent()) throw new Error("scholar_mentor_bonus_stale");
      g.used = true;
      g.targetId = targetId;
      committed = true;
    },
  });
}
export function scholarMentorConflictDeaths(world: World, day: number): NightLifeScope[] {
  const { b, r } = resolved(world, day);
  return r.pendingDeaths.map((id) => {
    const p = b.players.get(id)!;
    return Object.freeze({ id, life: p.life, version: aliveLifeVersion(p.life)! });
  });
}
export function closeScholarMentorNight(world: World, day: number): void {
  const { n } = resolved(world, day);
  if ([...n.grants.values()].some((g) => !g.used))
    throw new Error("scholar_mentor_bonus_unresolved");
  n.closed = true;
}
export function abortScholarMentorNight(world: World): void {
  const n = boards.get(world)?.night;
  if (n && !n.closed) {
    n.aborted = true;
    n.closed = true;
  }
}

export function scholarMentorRoleCanKnife(world: World | undefined, role: RoleComponent): boolean {
  if (!world || !boards.has(world)) return false;
  const b = requireBoard(world),
    n = b.night;
  if (!n || n.aborted) return false;
  const p = [...b.players.values()].find((p) => p.role === role);
  if (!p || !p.life.alive || !n.living.has(p.id)) return false;
  return (
    String(p.roleName) === "night_mentor" &&
    [...n.living].filter((id) => b.players.get(id)!.camp === Camp.Wolf).length === 1
  );
}
export function scholarMentorPackBlocked(world: World): boolean {
  if (!boards.has(world)) return false;
  const n = requireBoard(world).night;
  return !!n && !n.aborted && n.resolution?.blockWolfKnife === true;
}
