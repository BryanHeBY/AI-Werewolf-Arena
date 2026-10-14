/**
 * 负责野孩子参与者／榜样原生命、选择窗口、死亡提交与转阵营时序，拥有原 World 关系绑定。
 * 输入为原组件、首夜请求和实际死亡波；输出为原许可结果、阵营／Victory 及有界事实。
 * 不变量：仅在原身份／生命仍当前时提交；关闭、替换或截止别名仍按原政策撤权。
 * 槽所有者执行数据与 expectedState 写入；先发布榜样死亡事实再转换，失败不撤回已发表前缀。
 * 请求记录及别名传播归独立公共实例；请求字段失配只拒本次查询，原生命／准备撤权仍由本族决定。
 */
import { createCampComponent } from "../../../observation/component-presentation";
import type { WildChildReadState } from "@ai-werewolf-arena/game-contract";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { RequestLease } from "../../../../core/domain/request-lease";
import { COMPONENT, Camp, Role, Phase, createVictoryComponent, type World, type ActionRequest, type RoleComponent, type CampComponent, type VictoryComponent, type GameEvent, type DeathSources } from "../../../../core/domain";
import { aliveLifeVersion } from "../../../../core/domain/components/alive";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../../../core/domain/night_effects";
import { captureDebateParticipant, type DebateParticipant } from "../debater/authority";
import { getWildChildState, encodeWildChildData as safeJson,
  commitWildChildState, cancelWildChildState, transformWildChildState, activateWildChildState,
  projectWildChildData } from "./state-slot";
export interface WildChildBinding {
  world: World;
  actorId: number;
  actor: DebateParticipant;
  state: WildChildReadState;
  config: ReadonlyBoardConfig;
  configJson: string;
  camp: CampComponent;
  victory: VictoryComponent;
  expectedState: string;
  victoryJson: string;
  model: NightLifeScope | null;
  setup: "pending" | "active" | "complete" | "failed" | "cancelled";
  actorDeath: boolean;
  modelDeath: boolean;
  modelCommitted: boolean;
}
const bindings = new WeakMap<World, WildChildBinding>();
const nights = new WeakMap<World, Set<number>>();
const activeNights = new WeakSet<World>();
/** 只传原绑定字段／当前性晚查询；请求、context 和别名记录由本实例唯一持有。 */
const requestLease = RequestLease.stagePhaseDayActor<World, WildChildBinding>(
  {
    active: (world) => bindings.get(world),
    owner: (binding) => binding.world,
    actorId: (binding) => binding.actorId,
    phase: () => Phase.Night,
    stage: () => "wild_child",
    current: (binding) => validWildChildChoice(binding),
  },
  30,
);
const windows = new WeakMap<
  World,
  { isCurrent: () => boolean; targets: Map<number, DebateParticipant> }
>();

export function installWildChild(world: World, config: ReadonlyBoardConfig): void {
  if (bindings.has(world)) throw new Error("wild_child_already_installed");
  const actorId = world
    .entityIds()
    .find((id) => world.getComponent(id, COMPONENT.Role)?.role === Role.WildChild);
  if (actorId === undefined) return;
  const actor = captureDebateParticipant(world, actorId)!;
  const state = getWildChildState(actor.role)!;
  const camp = world.getComponent(actorId, COMPONENT.Camp)!;
  const victory = world.getComponent(actorId, COMPONENT.Victory)!;
  bindings.set(world, {
    world,
    actorId,
    actor,
    state,
    config,
    configJson: safeJson(config),
    camp,
    victory,
    expectedState: safeJson(state),
    victoryJson: safeJson(victory),
    model: null,
    setup: "pending",
    actorDeath: false,
    modelDeath: false,
    modelCommitted: false,
  });
}
export function wildChildBinding(world: World): WildChildBinding | undefined {
  return bindings.get(world);
}
function ownData(value: object, key: string): unknown {
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && Object.hasOwn(d, "value") ? d.value : undefined;
}
function captureChoiceTarget(world: World, id: number): DebateParticipant | null {
  const life = captureNightLife(world, id),
    role = world.getComponent(id, COMPONENT.Role);
  if (!life || !role) return null;
  const roleId = ownData(role, "role"),
    camp = ownData(role, "camp"),
    state = ownData(role, "privateState");
  if (typeof roleId !== "string" || typeof camp !== "string" || !state || typeof state !== "object")
    return null;
  return {
    life,
    role,
    roleId: roleId as RoleComponent["role"],
    camp: camp as RoleComponent["camp"],
    state: state as RoleComponent["privateState"],
  };
}
function sameChoiceTarget(world: World, snapshot: DebateParticipant): boolean {
  return (
    livingNightLife(world, snapshot.life) &&
    world.getComponent(snapshot.life.id, COMPONENT.Role) === snapshot.role &&
    ownData(snapshot.role, "role") === snapshot.roleId &&
    ownData(snapshot.role, "camp") === snapshot.camp &&
    ownData(snapshot.role, "privateState") === snapshot.state
  );
}
function validWildChildIdentity(b: WildChildBinding): boolean {
  return (
    bindings.get(b.world) === b &&
    b.world.getComponent(b.actorId, COMPONENT.Role) === b.actor.role &&
    ownData(b.actor.role, "role") === Role.WildChild &&
    ownData(b.actor.role, "camp") === b.actor.camp &&
    ownData(b.actor.role, "privateState") === b.actor.state &&
    ownData(b.actor.state, "wildChild") === b.state &&
    safeJson(b.state) !== "invalid" &&
    safeJson(b.state) === b.expectedState &&
    b.world.getComponent(b.actorId, COMPONENT.Camp) === b.camp &&
    ownData(b.camp, "camp") === b.actor.camp &&
    b.world.getComponent(b.actorId, COMPONENT.Victory) === b.victory &&
    safeJson(b.victory) !== "invalid" &&
    safeJson(b.victory) === b.victoryJson &&
    safeJson(b.config) !== "invalid" &&
    safeJson(b.config) === b.configJson
  );
}
export function validWildChildOwner(b: WildChildBinding): boolean {
  return validWildChildIdentity(b) && livingNightLife(b.world, b.actor.life);
}
export function projectWildChild(
  world: World,
  role: RoleComponent,
): WildChildReadState | undefined {
  const b = bindings.get(world);
  if (!b || b.actor.role !== role) return undefined;
  return projectWildChildData(b, () => validWildChildOwner(b));
}
export function wildChildReady(world: World): boolean {
  const b = bindings.get(world);
  return !b || b.setup === "complete";
}
export function hasActiveWildChild(world: World): boolean {
  return bindings.get(world)?.setup === "active" || activeNights.has(world);
}
export function hasWildChildNightCommit(world: World, day: number): boolean {
  return nights.get(world)?.has(day) ?? false;
}
export function openWildChildChoice(b: WildChildBinding, isCurrent: () => boolean): void {
  if (b.setup !== "pending" || !validWildChildOwner(b))
    throw new Error("wild_child_setup_unavailable");
  b.setup = "active";
  windows.set(b.world, {
    isCurrent,
    targets: new Map(
      b.world
        .getAliveEntityIds()
        .filter((id) => id !== b.actorId)
        .map((id) => [id, captureChoiceTarget(b.world, id)!]),
    ),
  });
}
export function validWildChildChoice(b: WildChildBinding): boolean {
  const w = windows.get(b.world);
  return (
    !!w &&
    w.isCurrent() &&
    b.setup === "active" &&
    validWildChildOwner(b) &&
    b.state.status === "pending" &&
    b.state.remaining === 1 &&
    b.state.choice === null &&
    [...w.targets.values()].every((p) => !!p && sameChoiceTarget(b.world, p))
  );
}
export function authorizedWildChild(
  world: World,
  actorId: number,
  day: number | undefined,
  phase: Phase,
  scope: object | undefined,
): boolean {
  const b = bindings.get(world);
  return (
    !!b &&
    b === scope &&
    actorId === b.actorId &&
    day === 1 &&
    phase === Phase.Night &&
    validWildChildChoice(b)
  );
}
export function bindWildChildRequest(world: World, request: ActionRequest): void {
  requestLease.bind(world, request);
}
export function wildChildRequestScope(
  world: World,
  request: ActionRequest,
): WildChildBinding | undefined {
  return requestLease.scope(world, request);
}
export function commitWildChildChoice(b: WildChildBinding, targetId: number): boolean {
  const target = windows.get(b.world)?.targets.get(targetId);
  if (!validWildChildChoice(b) || !target || !sameChoiceTarget(b.world, target)) return false;
  const choice = { day: 1 as const, targetId };
  if (!commitWildChildState(b, choice, () => target.life)) return false;
  b.setup = "complete";
  windows.delete(b.world);
  return true;
}
export function closeWildChildChoice(b: WildChildBinding, status: "failed" | "cancelled"): void {
  if (b.setup === "complete") return;
  b.setup = status;
  windows.delete(b.world);
  cancelWildChildState(b);
}
/** 紧邻实际引擎 Alive 提交之前调用，不由查询或原始拟议目标调用。 */
export function recordWildChildDeathCommit(world: World, id: number): void {
  const b = bindings.get(world);
  if (!b || !validWildChildIdentity(b)) return;
  if (id === b.actorId && livingNightLife(world, b.actor.life)) b.actorDeath = true;
  if (
    b.setup === "complete" &&
    !b.modelCommitted &&
    b.state.status === "chosen" &&
    b.model?.id === id &&
    livingNightLife(world, b.model)
  )
    b.modelDeath = true;
}
/** 调用前标记完整 pending 死亡波；后续射击波独立提交。 */
export function resolveWildChildDeathWave(
  world: World,
  ids: readonly number[],
  sources: DeathSources,
  day: number,
  phase: Phase,
  events: GameEvent[],
): void {
  const b = bindings.get(world),
    model = b?.model;
  if (
    !b ||
    !model ||
    !b.modelDeath ||
    b.modelCommitted ||
    !ids.includes(model.id) ||
    world.getComponent(model.id, COMPONENT.Alive) !== model.life ||
    model.life.alive ||
    aliveLifeVersion(model.life) !== model.version + 1
  )
    return;
  b.modelCommitted = true;
  const deathCommit = `wild-model:${b.actorId}:${model.id}:${day}`;
  events.push({
    timestamp: Date.now(),
    type: "wild_child_model_eliminated",
    payload: {
      actorId: b.actorId,
      targetId: model.id,
      day,
      phase,
      deathCommit,
      sources: [...(sources[model.id] ?? [])],
      deadIds: [...ids],
    },
  });
  if (
    !validWildChildOwner(b) ||
    b.state.status !== "chosen" ||
    b.actor.camp !== Camp.Good ||
    !["status", "eligibleNight"].every(
      (k) => Object.getOwnPropertyDescriptor(b.state, k)?.writable,
    ) ||
    !Object.getOwnPropertyDescriptor(b.actor.role, "camp")?.writable
  )
    return;
  const camp = createCampComponent(Camp.Wolf, world.locale),
    victory = createVictoryComponent([{ kind: "faction", faction: Camp.Wolf }]);
  b.actor.role.camp = Camp.Wolf;
  world.addComponent(b.actorId, COMPONENT.Camp, camp);
  world.addComponent(b.actorId, COMPONENT.Victory, victory);
  b.actor.camp = Camp.Wolf;
  b.camp = camp;
  b.victory = victory;
  b.victoryJson = safeJson(victory);
  transformWildChildState(b, day);
  events.push({
    timestamp: Date.now(),
    type: "wild_child_transformed",
    payload: { actorId: b.actorId, day, eligibleNight: day + 1, camp: Camp.Wolf, deathCommit },
  });
}
export function wildChildPackKnown(role: RoleComponent, world?: World): boolean {
  const b = world && bindings.get(world);
  if (
    !b ||
    b.actor.role !== role ||
    !validWildChildIdentity(b) ||
    b.setup !== "complete" ||
    b.state.status !== "active"
  )
    return false;
  return (
    livingNightLife(b.world, b.actor.life) ||
    (b.actorDeath &&
      b.world.getComponent(b.actorId, COMPONENT.Alive) === b.actor.life.life &&
      !b.actor.life.life.alive &&
      aliveLifeVersion(b.actor.life.life) === b.actor.life.version + 1)
  );
}
export function wildChildPackActive(role: RoleComponent, world?: World): boolean {
  const b = world && bindings.get(world);
  return !!b && wildChildPackKnown(role, world) && validWildChildOwner(b);
}
export function openWildChildNight(world: World, day: number, events: GameEvent[]): () => void {
  const b = bindings.get(world);
  if (!b) return () => {};
  if (hasActiveWildChild(world) || hasWildChildNightCommit(world, day) || !wildChildReady(world))
    throw new Error("wild_child_night_unavailable");
  const days = nights.get(world) ?? new Set<number>();
  days.add(day);
  nights.set(world, days);
  activeNights.add(world);
  try {
    if (
      validWildChildOwner(b) &&
      b.state.status === "transformed" &&
      b.state.eligibleNight !== null &&
      day >= b.state.eligibleNight &&
      ["status", "activeFromNight"].every(
        (k) => Object.getOwnPropertyDescriptor(b.state, k)?.writable,
      )
    ) {
      activateWildChildState(b, day);
      events.push({
        timestamp: Date.now(),
        type: "wild_child_pack_activated",
        payload: { actorId: b.actorId, day, eligibleNight: b.state.eligibleNight },
      });
    }
  } catch (error) {
    activeNights.delete(world);
    throw error;
  }
  return () => {
    activeNights.delete(world);
  };
}
