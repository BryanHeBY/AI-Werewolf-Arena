/**
 * 负责狼美人原源死亡后的未领取牵连 proposal。
 * 输入为死亡原体、原因和 hook 上下文；输出只引用当前绑定及原 nightEffect 旗标。
 * 实际领取、梦阻断和死亡提交随后由 relation owner 在原结算时点执行，不能在 hook 提前付款。
 * 失效关系不发 proposal；不修改库存、标死或发布事实。规则见 docs/rules/awa-wolf-beauty-v1.md。
 */
import { getWolfBeautyState } from "./state";
import { Role, DeathCause } from "../../../../core/domain/model";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import type { DeathHook } from "../../hooks/hook_registry";
import { activeCharm, permitsCharm } from "./relation";
import { animalBeautyLinkBlocked } from "../animal_dream/authority";

export const wolfBeautyDeathHook: DeathHook = async (
  world,
  ids,
  sources,
  _choose,
  events,
  context,
) => {
  const result: Awaited<ReturnType<DeathHook>> = { extraDeaths: [], extraDeathSources: {} };
  for (const actorId of ids) {
    if (animalBeautyLinkBlocked(world, context?.day ?? 0)) continue;
    if (context?.isCurrent && !context.isCurrent()) break;
    if (
      world.getComponent(actorId, COMPONENT.Role)?.role !== Role.WolfBeauty ||
      !permitsCharm(
        sources[actorId] ?? [],
        getWolfBeautyState(world.getComponent(actorId, COMPONENT.Role)!)?.deathLinkPolicy,
        context?.nativeHunterShotTargets?.has(actorId) ?? false,
      )
    )
      continue;
    const binding = activeCharm(world, actorId);
    if (
      !binding ||
      binding.actorLife.alive ||
      (!binding.targetLife.alive && !context?.eligibleDead?.has(binding.targetId))
    )
      continue;
    (result.charmLinks ??= []).push({ binding, nightEffect: context?.nightEffect ?? false });
  }
  return result;
};
