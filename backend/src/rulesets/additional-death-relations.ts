/**
 * 负责枪后追加波的完整夜梦、婚约、恋人／梦闭包和馥郁双生预约准备。
 * 输入为结算器同一提案／死因／夜来源／已见／下一波容器和晚读取的查询；输出为原双生回执及晚阶段查询。
 * 独立夜梦先于婚约，再展开恋人和派生梦，最后按原已见、已提交生命与存活过滤双生根；不统一各关系政策。
 * 各容器仍归结算器，具体关系和去重仍归机制；此步不标死、不更新 seen／next、不付款或提交／取消预约。
 * 关系事件或后续查询失败保留已发生前缀；来源阶段只在原逐目标提交点读取，未进入提交时不读当前 phase。
 */
import { DeathCause, type DeathSources, type EntityId, type GameEvent, type Phase } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../domain/components/names";
import type { World } from "../domain/world";
import type { DreamNightEffects } from "../domain/dream-night-effects";
import { expandLoversWave } from "../game/mechanisms/roles/cupid/death-ports";
import { prepareFragrantDeathWave } from "../game/mechanisms/roles/fragrant_pair_seer/ports";
import type { InitialWeddingExpansion } from "./initial-death-relations";

/** 只捕获结算器查询；调用时才取 World、事件、婚约实例和同一梦效果，不缓存状态或重建生命权威。 */
export interface AdditionalDeathRelationRuntime {
  world(): World;
  events(): GameEvent[];
  wedding(): InitialWeddingExpansion;
  dreams(): DreamNightEffects | undefined;
  isSettledLife(id: EntityId): boolean;
  phase(): Phase;
}

/** 原局部容器别名；linked 在调用方原分配点创建，追加准备只写该 Set，不建立第二份关系权威。 */
export interface AdditionalDeathRelationWave {
  readonly proposed: EntityId[];
  readonly proposedSources: DeathSources;
  readonly nightTargets: readonly EntityId[];
  readonly allSources: DeathSources;
  readonly next: ReadonlySet<EntityId>;
  readonly seen: ReadonlySet<EntityId>;
  readonly nightOrigin: Set<EntityId>;
  readonly linked: Set<EntityId>;
  readonly ownsFragrant: boolean;
  readonly resolutionDay: number;
  readonly sourcePhase: Phase;
}

/** 回执是原未提交预约，不是 JSON／付款证据；阶段方法由调用方在原写入参数位置晚调用。 */
export interface AdditionalDeathRelationPreparation {
  readonly fragrantGun: ReturnType<typeof prepareFragrantDeathWave>;
  originPhase(): Phase;
}

export function prepareAdditionalDeathRelations(
  runtime: AdditionalDeathRelationRuntime,
  wave: AdditionalDeathRelationWave,
): AdditionalDeathRelationPreparation {
  const { proposed, proposedSources, nightTargets, allSources, next, seen, nightOrigin, linked, ownsFragrant, resolutionDay, sourcePhase } = wave;
  // 原夜目标先登记来源，再取同一梦实例的方法；Dream 的独立根名单以原 allSources 编号为界。
  for (const id of nightTargets) nightOrigin.add(id);
  if (runtime.dreams() && nightTargets.length)
    for (const id of runtime.dreams()!.linkedDeaths(
      runtime.world(),
      nightTargets,
      new Set(Object.keys(allSources).map(Number)),
    )) {
      linked.add(id);
      if (!proposed.includes(id)) proposed.push(id);
      proposedSources[id] = [
        ...new Set([...(proposedSources[id] ?? []), DeathCause.Dream]),
      ];
      nightOrigin.add(id);
    }
  runtime.wedding().expand(proposed, proposedSources, seen, nightOrigin);
  expandLoversWave(
    runtime.world(),
    proposed,
    proposedSources,
    runtime.events(),
    nightOrigin,
    seen,
    runtime.dreams(),
  );
  const fragrantRoots = ownsFragrant
    ? proposed.filter(
        (id) =>
          !next.has(id) &&
          !seen.has(id) &&
          !runtime.isSettledLife(id) &&
          runtime.world().getComponent(id, COMPONENT.Alive)?.alive,
      )
    : [];
  const fragrantGun = ownsFragrant
    ? prepareFragrantDeathWave(runtime.world(), resolutionDay, fragrantRoots)
    : null;
  if (
    fragrantGun?.addedTargetId !== null &&
    fragrantGun?.addedTargetId !== undefined
  ) {
    // 原追加目标死因覆盖而非合并；预约尚未付款，commit/cancel仍由结算器原 try/finally 持有。
    proposed.push(fragrantGun.addedTargetId);
    proposedSources[fragrantGun.addedTargetId] = [DeathCause.FragrantLink];
  }
  return {
    fragrantGun,
    // 调用方已按原序登记 seen／allSources，才在 originPhases.set 的参数点查询；失败不撤销该前缀。
    originPhase: () => ownsFragrant ? runtime.phase() : sourcePhase,
  };
}
