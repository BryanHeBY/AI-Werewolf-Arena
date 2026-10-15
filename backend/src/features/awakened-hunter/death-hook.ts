/**
 * 负责真实死亡钩子与本族巡猎资格的窄装配。输入原死亡名单／根阶段／死因，输出已付不透明追加提案；
 * 时点是实际死亡波的遗言／警徽完成后；原体在N1绑定，无活原狼时不开请求。方向选择与临时许可归DR规则组合，库存只由本族owner提交。
 * 此hook不写Alive、不递归、不借普通Hunter枪权，任何请求异常保留此前真实前缀并交原结算器关闭许可。
 */
import { DeathCause, type DeathSources } from "@ai-werewolf-arena/game-contract";
import {
  ownDeathHook,
  type OwnedDeathCommands,
  type OwnedDeathHookBindingSource,
} from "../../engine/hooks/owned-bindings";
import type { DeathHookContext, DeathHookResult } from "../../engine/hooks/registry";
import { qualifyAwakenedPatrol, paidAwakenedPatrol, closeAwakenedPatrol } from "./authority";
function empty(): DeathHookResult {
  return { extraDeaths: [], extraDeathSources: {} };
}
async function resolve(
  source: OwnedDeathHookBindingSource,
  ids: number[],
  sources: DeathSources,
  context?: DeathHookContext,
): Promise<DeathHookResult> {
  if (ids.length !== 1 || context?.day === undefined || context.deathOriginPhase === undefined)
    return empty();
  const actorId = ids[0]!,
    world = source.world,
    day = context.day,
    root = context.deathOriginPhase;
  const qualification = qualifyAwakenedPatrol(
    world,
    actorId,
    day,
    root,
    sources[actorId] ?? [],
    () => context.isCurrent?.() ?? true,
  );
  if (!qualification) return empty();
  try {
    if (!source.chooseDeathPatrol) throw new Error("awakened_patrol_chooser_missing");
    const proposal = await source.chooseDeathPatrol(actorId, qualification);
    if (!proposal) return empty();
    const paid = paidAwakenedPatrol(world, proposal, day);
    if (!paid) throw new Error("awakened_patrol_paid_target_stale");
    return {
      extraDeaths: [paid.target.id],
      extraDeathSources: { [paid.target.id]: [DeathCause.AwakenedPatrol] },
      ...(root === "night" ? { nightEffectTargets: [paid.target.id] } : {}),
      pendingPatrols: [proposal],
    };
  } finally {
    closeAwakenedPatrol(qualification);
  }
}
export const AWAKENED_PATROL_DEATH_HOOK = ownDeathHook<OwnedDeathCommands>(
  (runtime, ids, sources, _choose, context) => runtime.ports.resolve(ids, sources, context),
  (source) => ({ resolve: (ids, sources, context) => resolve(source, ids, sources, context) }),
);
