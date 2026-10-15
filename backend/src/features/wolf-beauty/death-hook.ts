/**
 * 负责狼美人原源死亡后的未领取牵连 proposal。
 * 输入为死亡原体、原因和 hook 上下文；输出持有批量运行贡献，具体绑定及原 nightEffect 旗标留在本族闭包。
 * 实际领取、梦阻断和死亡提交随后由 relation owner 在原结算时点执行，不能在 hook 提前付款。
 * 失效关系不发 proposal；不修改库存、标死或发布事实。规则见 docs/rules/awa-wolf-beauty-v1.md。
 */
import { getWolfBeautyState } from "./state";
import { Role, DeathCause } from "../../domain/model";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import type { DeathHook } from "../../engine/hooks/registry";
import { activeCharm, permitsCharm, attemptCharmTrigger, commitCharmDeath } from "./relation";
import { createWolfBeautyDeathContribution } from "./death-wave-publication";
import { animalBeautyLinkBlocked } from "../animal-dream/beauty-query-ports";

export const wolfBeautyDeathHook: DeathHook = async (
  world,
  ids,
  sources,
  _choose,
  events,
  context,
) => {
  const result: Awaited<ReturnType<DeathHook>> = { extraDeaths: [], extraDeathSources: {} };
  let proposals: Parameters<typeof createWolfBeautyDeathContribution>[0][number][] | undefined;
  for (const actorId of ids) {
    // 动物原阻断查询先于 hook 当前性与来源政策；这里只准备未领取提案，不把公开查询变成死亡许可。
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
    (proposals ??= []).push({ binding, nightEffect: context?.nightEffect ?? false });
  }
  if (proposals) {
    // 只捕获命令查询；直到原准备／发布 callee 位置才获取同一 live binding。
    result.deathWaveContributions = [
      createWolfBeautyDeathContribution(proposals, {
        get attemptCharmTrigger() {
          return attemptCharmTrigger;
        },
        get commitCharmDeath() {
          return commitCharmDeath;
        },
      }),
    ];
  }
  return result;
};
