/**
 * 负责狼美人魅惑绑定、领取／阻断／实际死亡回执和放逐胜利边界。
 * 输入为原源／目标引用及死亡原因；输出为仍当前的关系和具体阶段结果，bindings 是唯一权威状态。
 * resolved 表示牵连已经领取，applied 表示目标确实死亡；梦阻断仍消耗领取，不能退款重触发。
 * 回执只保同一绑定的不可伪造运行时引用，不复制状态或授予死亡权限；不标死或发布事实。
 * 规则来源：docs/expansion/rules/awa-wolf-beauty-v1.md，各政策保留其独立来源抑制。
 */
import type { WolfBeautyReadState as WolfBeautyState } from "@ai-werewolf-arena/game-contract";

import { AliveComponent, aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import {
  Role,
  Camp,
  DeathCause,
  type DeathSources,
  type EntityId,
  type WinDecision,
} from "../../../../core/domain/model";
import type { World } from "../../../../core/domain/world";
import { getWolfBeautyState } from "./state";
import { getDefaultRoleCatalog } from "../catalog";
import { victoryDecision } from "../../win_conditions/results";

export interface CharmBinding {
  readonly actorId: EntityId;
  readonly targetId: EntityId;
  readonly role: Readonly<RoleComponent>;
  readonly state: WolfBeautyState;
  readonly actorLife: Readonly<AliveComponent>;
  readonly actorVersion: number | undefined;
  readonly targetLife: Readonly<AliveComponent>;
  readonly targetVersion: number | undefined;
  readonly resolved: boolean;
  readonly applied: boolean;
  readonly deathLinkPolicy: import("../../../../core/domain/board").BeautyDeathLinkPolicy;
}
const bindings = new WeakMap<World, Map<EntityId, CharmBinding>>();

// 回执只是本次触发的阶段结果；关系库存／原体资格始终由上面的单一 bindings 持有。
// 私有 Symbol 不进入 JSON，WeakSet 只标记身份，不保存第二份关系或 World 状态。
const RECEIPT_BRAND = Symbol("charm_receipt_brand");
const RECEIPT_BINDING = Symbol("charm_receipt_binding");
const issuedReceipts = new WeakSet<object>();
type CharmReceipt<K extends "claimed" | "blocked" | "applied"> = Readonly<{
  kind: K;
  [RECEIPT_BRAND]: true;
}>;
export type CharmClaimReceipt = CharmReceipt<"claimed">;
export type CharmBlockedReceipt = CharmReceipt<"blocked">;
export type CharmAppliedReceipt = CharmReceipt<"applied">;
export type CharmProtectionReceipt = CharmClaimReceipt | CharmBlockedReceipt;

function issueReceipt<K extends CharmProtectionReceipt["kind"] | "applied">(
  kind: K,
  binding: CharmBinding,
): CharmReceipt<K> {
  const receipt: CharmReceipt<K> = { kind, [RECEIPT_BRAND]: true };
  Object.defineProperty(receipt, RECEIPT_BINDING, { value: binding });
  issuedReceipts.add(receipt);
  return Object.freeze(receipt);
}
export function bindCharm(world: World, actorId: EntityId, targetId: EntityId | null): void {
  const map = bindings.get(world) ?? new Map<EntityId, CharmBinding>();
  bindings.set(world, map);
  map.delete(actorId);
  if (targetId === null) return;
  const role = world.getComponent(actorId, COMPONENT.Role)!,
    state = getWolfBeautyState(role)!,
    actorLife = world.getComponent(actorId, COMPONENT.Alive)!,
    targetLife = world.getComponent(targetId, COMPONENT.Alive)!;
  map.set(actorId, {
    actorId,
    targetId,
    role,
    state,
    actorLife,
    actorVersion: aliveLifeVersion(actorLife),
    targetLife,
    targetVersion: aliveLifeVersion(targetLife),
    resolved: false,
    applied: false,
    deathLinkPolicy: state.deathLinkPolicy ?? "awa_exile_poison_v1",
  });
}
function current(world: World, binding: CharmBinding): boolean {
  return (
    world.getComponent(binding.actorId, COMPONENT.Role) === binding.role &&
    binding.role.role === Role.WolfBeauty &&
    getWolfBeautyState(binding.role) === binding.state &&
    binding.state.targetId === binding.targetId &&
    (binding.state.deathLinkPolicy ?? "awa_exile_poison_v1") === binding.deathLinkPolicy &&
    world.getComponent(binding.actorId, COMPONENT.Alive) === binding.actorLife &&
    binding.actorVersion !== undefined &&
    aliveLifeVersion(binding.actorLife) ===
      binding.actorVersion + (binding.actorLife.alive ? 0 : 1) &&
    world.getComponent(binding.targetId, COMPONENT.Alive) === binding.targetLife &&
    binding.targetVersion !== undefined &&
    aliveLifeVersion(binding.targetLife) ===
      binding.targetVersion + (binding.targetLife.alive ? 0 : 1)
  );
}
export function activeCharm(world: World, actorId: EntityId): CharmBinding | null {
  const binding = bindings.get(world)?.get(actorId);
  return binding && !binding.resolved && current(world, binding) ? binding : null;
}
/** 在追加死因或标死之前同步领取；同波原体允许首次死亡版本，不接受复活或替身。 */
function claimCharm(
  world: World,
  binding: CharmBinding,
  eligibleDead: ReadonlySet<EntityId>,
): boolean {
  if (
    activeCharm(world, binding.actorId) !== binding ||
    binding.actorLife.alive ||
    (!binding.targetLife.alive && !eligibleDead.has(binding.targetId))
  )
    return false;
  (binding as { resolved: boolean }).resolved = true;
  return true;
}
/**
 * 具体触发流程拥有来源政策→原体领取→夜梦阻断分类；World 与保护查询都延迟到原表达式位置。
 * 不提前获取 World，permit 不合格时也不读保护；阻断／查询抛错仍保已经 resolved 的原付款。
 */
export function attemptCharmTrigger(
  binding: CharmBinding,
  sources: DeathSources,
  nativeHunterShotTargets: ReadonlySet<EntityId>,
  eligibleDead: ReadonlySet<EntityId>,
  world: () => World,
  blocksNightCharm: () => unknown,
): CharmProtectionReceipt | null {
  if (
    !permitsCharm(
      sources[binding.actorId] ?? [],
      binding.deathLinkPolicy,
      nativeHunterShotTargets.has(binding.actorId),
    ) ||
    !claimCharm(world(), binding, eligibleDead)
  )
    return null;
  return issueReceipt(blocksNightCharm() ? "blocked" : "claimed", binding);
}

/** 实际目标标死之后提交 applied；回执不能替代原同绑定、角色、政策及生命版本检查。 */
export function commitCharmDeath(
  world: World,
  receipt: CharmClaimReceipt,
): CharmAppliedReceipt | null {
  if (!issuedReceipts.has(receipt) || receipt.kind !== "claimed") return null;
  const binding = (receipt as CharmClaimReceipt & { readonly [RECEIPT_BINDING]: CharmBinding })[
    RECEIPT_BINDING
  ];
  if (
    bindings.get(world)?.get(binding.actorId) !== binding ||
    !binding.resolved ||
    !current(world, binding) ||
    binding.targetLife.alive
  )
    return null;
  (binding as { applied: boolean }).applied = true;
  return issueReceipt("applied", binding);
}
export interface BeautyExileCandidate {
  actorId: EntityId;
  targetId: EntityId;
  side: "god" | "villager";
  binding: CharmBinding;
}
/** 仅在真实放逐已确定、完整死亡波尚未执行时捕获候选，不提前封盘。 */
export function captureBeautyExile(world: World, actorId: EntityId): BeautyExileCandidate | null {
  const actor = world.getComponent(actorId, COMPONENT.Role),
    binding = activeCharm(world, actorId);
  if (
    actor?.role !== Role.WolfBeauty ||
    actor.camp !== Camp.Wolf ||
    !binding ||
    !binding.targetLife.alive
  )
    return null;
  if (
    world
      .getAliveEntityIds()
      .some((id) => id !== actorId && world.getComponent(id, COMPONENT.Role)?.camp === Camp.Wolf)
  )
    return null;
  const target = world.getComponent(binding.targetId, COMPONENT.Role),
    side = target ? getDefaultRoleCatalog().get(target.role)?.goodSide : undefined;
  return target?.camp === Camp.Good && side
    ? { actorId, targetId: binding.targetId, side, binding }
    : null;
}
export function resolveBeautyExileVictory(
  world: World,
  candidate: BeautyExileCandidate | null,
): WinDecision | null {
  if (
    !candidate ||
    !candidate.binding.applied ||
    !current(world, candidate.binding) ||
    candidate.binding.targetLife.alive
  )
    return null;
  const sideAlive = world.getAliveEntityIds().some((id) => {
    const role = world.getComponent(id, COMPONENT.Role);
    return (
      role?.camp === Camp.Good &&
      getDefaultRoleCatalog().get(role.role)?.goodSide === candidate.side
    );
  });
  return sideAlive
    ? null
    : victoryDecision(world, { kind: "faction", faction: Camp.Wolf }, "wolf_beauty_last_exile");
}
export function permitsCharm(
  sources: readonly DeathCause[],
  policy: import("../../../../core/domain/board").BeautyDeathLinkPolicy = "awa_exile_poison_v1",
  nativeHunterShot = false,
): boolean {
  // S7 仅规定放逐／原生猎人；未定义的复合死因先按抑制处理，不把赠枪当原生枪。
  if (policy === "heroes_s7_2017_exile_hunter_v1")
    return (
      sources.length > 0 &&
      sources.every(
        (source) => source === DeathCause.Exile || (source === DeathCause.Shot && nativeHunterShot),
      )
    );
  if (policy !== "awa_exile_poison_v1") return false;
  return (
    !sources.includes(DeathCause.Lovers) &&
    !sources.includes(DeathCause.Duel) &&
    !sources.includes(DeathCause.Dream) &&
    sources.some((source) => source === DeathCause.Exile || source === DeathCause.Poison)
  );
}
