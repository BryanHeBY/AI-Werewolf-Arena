/**
 * 负责狼美人放逐定案的候选捕获、整侧完成核对及屠边覆盖数据，保留两个同步业务时点。
 * 输入为原有效放逐结果、晚读 World 和同一魅惑绑定；输出为原目标、可写候选或真实 Victory 成员判定。
 * 普通板在死亡波前捕获末狼和目标侧；波后仍需 applied、原体当前性及目标实际死亡，不能靠提案提前获胜。
 * 覆盖只供 exile_settled 的 slaughter_side 项，配置首命中顺序和唯一封盘仍归经理／条件注册表。
 * 本模块不持第二份关系、不领取牵连、不退款、不标死、不推进阶段；查询异常保留已提交死亡前缀。
 * 规则见 docs/rules/awa-wolf-beauty-v1.md；候选不进入玩家知识或档案，不授予行动权限。
 */
import { Camp, Role, WinCondition, type EntityId, type VotingSummary, type WinDecision } from "../core/domain/model";
import { COMPONENT } from "../core/domain/components/names";
import type { World } from "../core/domain/world";
import { activeCharm, isCharmBindingCurrent, type CharmBinding } from "../game/mechanisms/roles/wolf_beauty/ports";
import { getDefaultRoleCatalog } from "../game/mechanisms/roles/role-catalog-assembly";
import { victoryDecision } from "../game/mechanisms/win_conditions/results";

/** 仅读原结果字段；readonly 不冻结原数组，也不证明目标已经死亡或取得死亡许可。 */
export interface BeautyExileSelection {
  readonly summary: Pick<VotingSummary, "target" | "effectiveTarget">;
  readonly removed: readonly EntityId[];
}

/** 仍为原可写候选，绑定保同一运行引用；目标侧只在死亡波前捕获，不在波后重新推断。 */
export interface BeautyExileCandidate {
  actorId: EntityId;
  targetId: EntityId;
  side: "god" | "villager";
  binding: CharmBinding;
}
/**
 * 只在经理原普通放逐分支调用；effectiveTarget 有定义时保留原两次 getter 读取。
 * 先核非 null 和真实移除名单，之后才取得 World；不合格目标不捕获关系或查询隐藏狼数。
 */
export function prepareBeautyExileVictory(
  selection: BeautyExileSelection,
  world: () => World,
): { target: EntityId | null; candidate: BeautyExileCandidate | null } {
  const target =
    selection.summary.effectiveTarget === undefined
      ? selection.summary.target
      : selection.summary.effectiveTarget;
  const candidate = target !== null && selection.removed.includes(target)
    ? captureBeautyExile(world(), target)
    : null;
  return { target, candidate };
}

/** 仅在真实放逐已确定、完整死亡波尚未执行时捕获候选；实际Camp在各原比较点晚读，不提前封盘。 */
function captureBeautyExile(world: World, actorId: EntityId): BeautyExileCandidate | null {
  const actor = world.getComponent(actorId, COMPONENT.Role),
    binding = activeCharm(world, actorId);
  if (
    actor?.role !== Role.WolfBeauty ||
    world.getComponent(actorId, COMPONENT.Camp)?.camp !== Camp.Wolf ||
    !binding ||
    !binding.targetLife.alive
  )
    return null;
  if (
    world
      .getAliveEntityIds()
      .some((id) => id !== actorId && !!world.getComponent(id, COMPONENT.Role) && world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Wolf)
  )
    return null;
  const target = world.getComponent(binding.targetId, COMPONENT.Role),
    side = target ? getDefaultRoleCatalog().metadata(target.role)?.goodSide : undefined;
  return target && world.getComponent(binding.targetId, COMPONENT.Camp)?.camp === Camp.Good && side
    ? { actorId, targetId: binding.targetId, side, binding }
    : null;
}
/**
 * 调用方已完成死亡波并通过原当前性守卫；已领取／被阻断仍不等于 applied。
 * 原绑定校验继续归 relation，同侧存活扫描之后才由共同结果 owner 捕获真实 Victory 成员。
 */
export function resolveBeautyExileVictory(
  world: World,
  candidate: BeautyExileCandidate | null,
): WinDecision | null {
  if (
    !candidate ||
    !candidate.binding.applied ||
    !isCharmBindingCurrent(world, candidate.binding) ||
    candidate.binding.targetLife.alive
  )
    return null;
  const sideAlive = world.getAliveEntityIds().some((id) => {
    const role = world.getComponent(id, COMPONENT.Role);
    return (
      role && world.getComponent(id, COMPONENT.Camp)?.camp === Camp.Good &&
      getDefaultRoleCatalog().metadata(role.role)?.goodSide === candidate.side
    );
  });
  return sideAlive
    ? null
    : victoryDecision(world, { kind: "faction", faction: Camp.Wolf }, "wolf_beauty_last_exile");
}

/**
 * 在经理 checkAndSealResult 的第二实参位置生成覆盖，不能提前到 callee 或 checkpoint 读取之前。
 * 空结果仍返回原空对象；只覆盖屠边项，不绕过配置中排在前面的其它胜利条件。
 */
export function beautyExileVictoryOverrides(
  result: WinDecision | null,
): Partial<Record<WinCondition, WinDecision>> {
  return result ? { [WinCondition.SlaughterSide]: result } : {};
}
