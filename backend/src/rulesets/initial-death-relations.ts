/**
 * 负责初始死亡波的完整婚约、恋人／梦与馥郁双生关系准备及原公开追加事实。
 * 输入为原可写名单／死因／已纳入席位／来源阶段容器和晚读取的运行查询；输出为同一双生回执与来源阶段 Map。
 * 婚约先于恋人／梦扩张，再登记来源阶段、准备双生回执并追加目标；死因仍在调用方同一容器原地覆盖或追加。
 * Night 的婚约关联不进入本步公开 additional_deaths，恋人关联及双生专用发布保持原政策和失败前缀。
 * 具体关系授权与已付绑定归各机制；本步不标死、付款、关闭许可、提交／取消回执、清理或确定胜负。
 * 准备回执只在结算器原 commit/cancel/finally 位置消费；运行关系／梦句柄不是 JSON 或玩家许可。
 */
import { Phase, DeathCause, type DeathSources, type EntityId, type GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../domain/world";
import type { DreamNightEffects } from "../domain/dream-night-effects";
import { expandLoversWave } from "../features/cupid/death-ports";
import { prepareFragrantDeathWave } from "../features/fragrant-pair-seer/ports";

/** 原具体婚约对象的窄方法视图；保留实例和 expand receiver，不创建第二个关系所有者。 */
export interface InitialWeddingExpansion {
  expand(ids: EntityId[], sources: DeathSources, seen: ReadonlySet<EntityId>, nightOrigin: Set<EntityId>): EntityId[];
}

/** 只在原表达式位置读取；装配时不取得 World、事件、日期、梦或具体婚约对象。 */
export interface InitialDeathRelationRuntime {
  world(): World;
  events(): GameEvent[];
  wedding(): InitialWeddingExpansion;
  phase(): Phase;
  resolutionDay(): number;
  ownsFragrant(): boolean;
  dreams(): DreamNightEffects | undefined;
}

/** 原双生准备回执不复制成授权数据，originPhases 用于原后续死亡波而非更改当前阶段。 */
export interface InitialDeathRelationPreparation {
  fragrantInitial: ReturnType<typeof prepareFragrantDeathWave>;
  originPhases: Map<EntityId, Phase>;
}

/** 同步准备完整初始关系；事件或后续字段读取失败时保留此前名单、来源与机制回执前缀。 */
export function prepareInitialDeathRelations(
  runtime: InitialDeathRelationRuntime,
  pending: EntityId[],
  allSources: DeathSources,
  seen: Set<EntityId>,
  nightOrigin: Set<EntityId>,
  initialPhases: Record<EntityId, Phase>,
): InitialDeathRelationPreparation {
  // 关系闭包先于标死、遗言和枪权判断；恋人／婚约追加的抑制死因不能等死亡 hook 后再补。
  const weddingInitial = runtime.wedding().expand(pending, allSources, seen, nightOrigin);
  const linkedInitial = expandLoversWave(
    runtime.world(),
    pending,
    allSources,
    runtime.events(),
    nightOrigin,
    seen,
    runtime.dreams(),
  );
  for (const id of [...linkedInitial, ...weddingInitial]) {
    seen.add(id);
    initialPhases[id] = nightOrigin.has(id) ? Phase.Night : runtime.phase();
  }
  const fragrantInitial = runtime.ownsFragrant()
    ? prepareFragrantDeathWave(runtime.world(), runtime.resolutionDay(), pending)
    : null;
  const fragrantRootPhase = fragrantInitial
    ? (initialPhases[fragrantInitial.rootId] ??
      (nightOrigin.has(fragrantInitial.rootId) ? Phase.Night : runtime.phase()))
    : runtime.phase();
  if (fragrantInitial?.addedTargetId !== null && fragrantInitial?.addedTargetId !== undefined) {
    const id = fragrantInitial.addedTargetId;
    pending.push(id);
    seen.add(id);
    // 原追加目标死因是覆盖而非合并；预约回执尚未提交，也不在这里付款或取消。
    allSources[id] = [DeathCause.FragrantLink];
    initialPhases[id] = fragrantRootPhase;
    if (fragrantRootPhase === Phase.Night) nightOrigin.add(id);
  }
  const originPhases = new Map(
    pending.map((id) => [id, initialPhases[id] ?? (nightOrigin.has(id) ? Phase.Night : runtime.phase())]),
  );
  // Night 婚约私密事实归具体机制；本步只沿原策略选择公开名单，不扩大披露范围。
  const publicLinkedInitial = [
    ...linkedInitial,
    ...(runtime.phase() === Phase.Night ? [] : weddingInitial),
  ];
  if (publicLinkedInitial.length && !runtime.ownsFragrant())
    runtime.events().push({
      timestamp: Date.now(),
      type: "additional_deaths",
      payload: { deaths: publicLinkedInitial },
    });
  return { fragrantInitial, originPhases };
}
