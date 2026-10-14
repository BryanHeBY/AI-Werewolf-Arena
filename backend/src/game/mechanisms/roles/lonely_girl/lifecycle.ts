/**
 * 负责孤独少女首夜选择、原参与者／生命与独立 Victory 归属，拥有原关系绑定及窗口时序。
 * 输入为原 World 参与者和首夜请求；输出为已接受选择、捕获目标阵营对应的成员关系及原准备结果。
 * 不变量：仅在原身份／资源仍匹配时提交；关闭或替换参与者使 scope 失效，包括期限别名。
 * 选择不改变演员的 Role／Camp，已选成员关系在双方死亡后仍保留；本模块不新增目标死亡结算。
 * 数据写由槽执行，失败窗口审计保留原授权身份，不读取外来 accessor 或恢复已消耗库存。
 * 请求记录及别名传播归独立公共实例；请求字段失配只拒本次查询，原生命／准备撤权仍由本族决定。
 */
import type { LonelyGirlReadState } from "@ai-werewolf-arena/game-contract";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { RequestLease } from "../../../../core/domain/request-lease";
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import {
  COMPONENT,
  Camp,
  Role,
  Phase,
  createVictoryComponent,
  type World,
  type ActionRequest,
  type RoleComponent,
  type CampComponent,
  type VictoryComponent,
} from "../../../../core/domain";
import { aliveLifeVersion, type AliveComponent } from "../../../../core/domain/components/alive";
import { freshLonelyGirlState, getLonelyGirlState, LONELY_GIRL_POLICY, lonelyData,
  consumeLonelyGirlState, cancelLonelyGirlState, projectLonelyGirlData } from "./state-slot";
interface Participant {
  id: number;
  life: AliveComponent;
  version: number;
  alive: PropertyDescriptor;
  role: RoleComponent;
  kind: Role;
  roleCamp: Camp;
  state: RoleComponent["privateState"];
  camp: CampComponent;
  campValue: Camp;
  privateSnapshot: Record<string, unknown>;
}
export interface LonelyGirlBinding {
  world: World;
  actorId: number;
  actor: Participant;
  participants: ReadonlyMap<number, Participant>;
  state: LonelyGirlReadState;
  config: ReadonlyBoardConfig;
  configJson: string;
  victory: VictoryComponent;
  affiliations: VictoryComponent["affiliations"];
  status: "pending" | "active" | "complete" | "failed" | "cancelled";
  choice: LonelyGirlReadState["choice"];
  membership: Camp | null;
  isCurrent: (() => boolean) | null;
}
const bindings = new WeakMap<World, LonelyGirlBinding>(),
  nights = new WeakMap<World, Set<number>>(),
  activeNights = new WeakSet<World>();
/** phase 先于 context 身份的原协议独立保留；不复制选择许可或引入请求永久撤权。 */
const requestLease = RequestLease.actorPhaseStageDay<World, LonelyGirlBinding>(
  {
    active: (world) => bindings.get(world),
    owner: (binding) => binding.world,
    actorId: (binding) => binding.actorId,
    phase: () => Phase.Night,
    stage: () => "lonely_girl",
    current: (binding) => validLonelyGirlChoice(binding),
  },
  40,
);
function safeJson(value: unknown): string | null {
  try {
    const p = copyEventData(value);
    return p === null ? null : JSON.stringify(p);
  } catch {
    return null;
  }
}
function capture(world: World, id: number): Participant | null {
  const life = world.getComponent(id, COMPONENT.Alive),
    role = world.getComponent(id, COMPONENT.Role),
    camp = world.getComponent(id, COMPONENT.Camp),
    version = life && aliveLifeVersion(life),
    alive = life && Object.getOwnPropertyDescriptor(life, "alive"),
    kind = lonelyData(role, "role"),
    roleCamp = lonelyData(role, "camp"),
    state = lonelyData(role, "privateState"),
    campValue = lonelyData(camp, "camp");
  if (
    !life ||
    version === undefined ||
    !alive ||
    life.alive !== true ||
    !role ||
    !camp ||
    typeof kind !== "string" ||
    !state ||
    typeof state !== "object" ||
    ![Camp.Good, Camp.Wolf].includes(roleCamp as Camp) ||
    campValue !== roleCamp
  )
    return null;
  return {
    id,
    life,
    version,
    alive,
    role,
    kind: kind as Role,
    roleCamp: roleCamp as Camp,
    state: state as RoleComponent["privateState"],
    camp,
    campValue: campValue as Camp,
    privateSnapshot: structuredClone(state) as Record<string, unknown>,
  };
}
function same(world: World, p: Participant): boolean {
  const d = Object.getOwnPropertyDescriptor(p.life, "alive");
  return (
    world.getComponent(p.id, COMPONENT.Alive) === p.life &&
    aliveLifeVersion(p.life) === p.version &&
    !!d &&
    d.get === p.alive.get &&
    d.set === p.alive.set &&
    d.value === p.alive.value &&
    p.life.alive === true &&
    world.getComponent(p.id, COMPONENT.Role) === p.role &&
    lonelyData(p.role, "role") === p.kind &&
    lonelyData(p.role, "camp") === p.roleCamp &&
    lonelyData(p.role, "privateState") === p.state &&
    world.getComponent(p.id, COMPONENT.Camp) === p.camp &&
    lonelyData(p.camp, "camp") === p.campValue
  );
}
export function installLonelyGirl(world: World, config: ReadonlyBoardConfig): void {
  if (bindings.has(world)) throw new Error("lonely_girl_already_installed");
  const actorId = world
    .entityIds()
    .find((id) => lonelyData(world.getComponent(id, COMPONENT.Role), "role") === Role.LonelyGirl);
  if (actorId === undefined) return;
  const participants = new Map(world.entityIds().map((id) => [id, capture(world, id)] as const)),
    actor = participants.get(actorId),
    state = getLonelyGirlState(actor?.role),
    victory = world.getComponent(actorId, COMPONENT.Victory),
    affiliations = lonelyData(victory, "affiliations"),
    configJson = safeJson(config);
  if (
    !actor ||
    !state ||
    !victory ||
    !Array.isArray(affiliations) ||
    safeJson(affiliations) !== "[]" ||
    !configJson ||
    [...participants.values()].some((p) => !p)
  )
    throw new Error("lonely_girl_initial_state_invalid");
  bindings.set(world, {
    world,
    actorId,
    actor,
    participants: participants as Map<number, Participant>,
    state,
    config,
    configJson,
    victory,
    affiliations,
    status: "pending",
    choice: null,
    membership: null,
    isCurrent: null,
  });
}
export function lonelyGirlBinding(world: World): LonelyGirlBinding | undefined {
  return bindings.get(world);
}
function pendingOwner(b: LonelyGirlBinding): boolean {
  const rem = Object.getOwnPropertyDescriptor(b.state, "remaining"),
    choice = Object.getOwnPropertyDescriptor(b.state, "choice");
  return (
    bindings.get(b.world) === b &&
    b.participants.size === b.world.entityIds().length &&
    [...b.participants.values()].every((p) => same(b.world, p)) &&
    b.actor.kind === Role.LonelyGirl &&
    b.actor.roleCamp === Camp.Good &&
    getLonelyGirlState(b.actor.role) === b.state &&
    rem?.value === 1 &&
    rem.writable === true &&
    choice?.value === null &&
    choice.writable === true &&
    b.world.getComponent(b.actorId, COMPONENT.Victory) === b.victory &&
    lonelyData(b.victory, "affiliations") === b.affiliations &&
    safeJson(b.affiliations) === "[]" &&
    safeJson(b.config) === b.configJson
  );
}
export function lonelyGirlReady(world: World): boolean {
  const b = bindings.get(world);
  return b
    ? b.status === "complete"
    : !world
        .entityIds()
        .some(
          (id) => lonelyData(world.getComponent(id, COMPONENT.Role), "role") === Role.LonelyGirl,
        );
}
export function hasActiveLonelyGirl(world: World): boolean {
  return bindings.get(world)?.status === "active" || activeNights.has(world);
}
export function hasLonelyGirlNightCommit(world: World, day: number): boolean {
  return nights.get(world)?.has(day) ?? false;
}
export function openLonelyGirlChoice(b: LonelyGirlBinding, isCurrent: () => boolean): boolean {
  if (b.status !== "pending") throw new Error("lonely_girl_setup_unavailable");
  b.status = "active";
  b.isCurrent = isCurrent;
  return validLonelyGirlChoice(b);
}
export function validLonelyGirlChoice(b: LonelyGirlBinding): boolean {
  return b.status === "active" && b.isCurrent?.() === true && pendingOwner(b);
}
export function authorizedLonelyGirl(
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
    b.actorId === actorId &&
    day === 1 &&
    phase === Phase.Night &&
    validLonelyGirlChoice(b)
  );
}
export function bindLonelyGirlRequest(world: World, request: ActionRequest): void {
  requestLease.bind(world, request);
}
export function lonelyGirlRequestScope(
  world: World,
  request: ActionRequest,
): LonelyGirlBinding | undefined {
  return requestLease.scope(world, request);
}
export function commitLonelyGirlChoice(b: LonelyGirlBinding, targetId: number): Camp | null {
  const target = b.participants.get(targetId);
  if (!target || targetId === b.actorId || !validLonelyGirlChoice(b)) return null;
  const choice = { day: 1 as const, targetId },
    membership = createVictoryComponent([{ kind: "faction", faction: target.campValue }]);
  // 最后权限检查后依次交数据所有者写库存与选择，再安装 Victory；两者之间没有 await。
  consumeLonelyGirlState(b, choice);
  b.world.addComponent(b.actorId, COMPONENT.Victory, membership);
  b.choice = Object.freeze({ ...choice });
  b.membership = target.campValue;
  b.status = "complete";
  b.isCurrent = null;
  return target.campValue;
}
export function closeLonelyGirlChoice(b: LonelyGirlBinding, status: "failed" | "cancelled"): void {
  if (b.status === "complete") return;
  b.status = status;
  b.isCurrent = null;
  cancelLonelyGirlState(b);
}
export function projectLonelyGirl(
  world: World,
  role: RoleComponent,
): LonelyGirlReadState | undefined {
  const b = bindings.get(world);
  if (!b || b.actor.role !== role) return undefined;
  return projectLonelyGirlData(b, () => pendingOwner(b));
}
export function projectLonelyGirlSetup(world: World) {
  const b = bindings.get(world);
  return b
    ? {
        policy: LONELY_GIRL_POLICY,
        status: b.status === "active" ? ("pending" as const) : b.status,
        actorId: b.actorId,
      }
    : undefined;
}
export function projectLonelyGirlVictory(
  world: World,
  actorId: number,
): VictoryComponent | undefined {
  const b = bindings.get(world);
  return b?.actorId === actorId
    ? createVictoryComponent(b.membership ? [{ kind: "faction", faction: b.membership }] : [])
    : undefined;
}
export function openLonelyGirlNight(world: World, day: number): () => void {
  if (!bindings.has(world)) return () => {};
  if (hasActiveLonelyGirl(world) || !lonelyGirlReady(world) || hasLonelyGirlNightCommit(world, day))
    throw new Error("lonely_girl_night_unavailable");
  const days = nights.get(world) ?? new Set<number>();
  days.add(day);
  nights.set(world, days);
  activeNights.add(world);
  return () => {
    activeNights.delete(world);
  };
}

/** 失败窗口审计使用原授权身份／资源，不读取 foreign accessor。 */
export function projectLonelyGirlAuditPlayer(world: World, id: number) {
  const b = bindings.get(world),
    p = b?.participants.get(id);
  if (!b || !p || (b.status !== "failed" && b.status !== "cancelled")) return undefined;
  const alive = p.alive.get ? p.alive.get.call(p.life) === true : p.alive.value === true;
  return {
    role: p.kind,
    camp: p.roleCamp,
    alive,
    privateState:
      id === b.actorId
        ? { lonelyGirl: { ...freshLonelyGirlState(), remaining: 0 } }
        : structuredClone(p.privateSnapshot),
  };
}
