/**
 * 负责普通黎明的完整死亡提案与公开夜报名单选择。输入为同一夜伤害、原生命 Map、狐狸已付目标查询和可选白天自爆；
 * 输出为原序复制／合并的名单、死因、来源阶段及初始提交发布回调，不修改生命、库存或经理的完成标志。
 * 狐狸原因在实际 filter 点晚复验，原生命按引用、存活及版本匹配；普通板先公布，动物／双生板在原提交回调公布。
 * World、配置和夜字段仍在原表达式位置读取，发布入口先查经理 callee，再求名单；前项异常停止后项并保已发表前缀。
 * 经理保 nightSettled 首写、真实死亡 await、finish／abort finally、阶段当前性与唯一封盘；本组合没有第二份状态或通用死亡引擎。
 */
import { DeathCause, Phase, type EntityId, type DeathSources, type GameEvent } from "@ai-werewolf-arena/game-contract";
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import { COMPONENT } from "../domain/components/names";
import { aliveLifeVersion } from "../domain/components/alive";
import type { World } from "../domain/world";
import type { NightFoxInspectionClaim } from "../domain/night-effects";
import type { DamageResolutionResult } from "../domain/systems/damage-resolution-system";
import type { DeathCommitReceipt, DeathOriginalLife } from "../engine/death-wave";

/** 只声明真实读取字段；伤害和已付 claim 原引用保留，不冻结回调或提前快照其当前性。 */
export interface OrdinaryNightDeathInput {
  readonly damage: DamageResolutionResult;
  readonly deathLives: ReadonlyMap<EntityId, DeathOriginalLife>;
  readonly foxInspections?: readonly NightFoxInspectionClaim[];
}

/** 名单 thunk 只为保原 publish callee→名单参数顺序；它不是许可或一次完成回执。 */
export interface OrdinaryNightDeathRuntime {
  readonly world: World;
  readonly night: OrdinaryNightDeathInput;
  readonly config: Pick<ReadonlyBoardConfig, "fragrantPairSeer" | "animalDream">;
  publishNightResolved(deaths: () => EntityId[]): GameEvent;
}

/** 自爆来源仍属于白天；同编号与夜死并存时保原首次名单位置和逐来源去重顺序。 */
export interface OrdinaryNightBlast {
  deaths: number[];
  sources: DeathSources;
}

/** 本步的局部可写副本；伤害与生命 Map 是原引用，空 filter 不额外取得 originalLives。 */
export interface OrdinaryNightDeathProposal {
  sourceDamage: DamageResolutionResult;
  originalLives: ReadonlyMap<EntityId, DeathOriginalLife> | undefined;
  retainedSources: DeathSources;
  nightDeaths: EntityId[];
  sources: DeathSources;
  deaths: EntityId[];
  deathPhases: Record<EntityId, Phase>;
}

/** 经理已在原点写 nightSettled；本步准备失败不标死、不退款，也不提前进入经理的 DR try/finally。 */
export function prepareOrdinaryNightDeaths(
  runtime: OrdinaryNightDeathRuntime,
  blast?: OrdinaryNightBlast,
): OrdinaryNightDeathProposal {
  let sourceDamage: DamageResolutionResult;
  let originalLives: ReadonlyMap<EntityId, DeathOriginalLife> | undefined;
  const retainedSources: DeathSources = Object.fromEntries(
    (sourceDamage = runtime.night.damage).deaths.map((id) => [
      id,
      (runtime.night.damage.deathSources[id] ?? []).filter(
        (source) =>
          source !== DeathCause.FoxInspection ||
          runtime.night.foxInspections?.some(
            (claim) => claim.target.id === id && claim.isTargetCurrent(),
          ),
      ),
    ]),
  );
  // 原每个候选位置才读 Map；先有保留原因，再查询 World 和原生命版本，不把当前席位的新生命替代旧提案。
  const nightDeaths = runtime.night.damage.deaths.filter((id) => {
    const scope = (originalLives = runtime.night.deathLives).get(id);
    return (
      scope &&
      retainedSources[id]?.length &&
      runtime.world.getComponent(id, COMPONENT.Alive) === scope.life &&
      scope.life.alive &&
      scope.version !== undefined &&
      aliveLifeVersion(scope.life) === scope.version
    );
  });
  if (!runtime.config.fragrantPairSeer && !runtime.config.animalDream)
    runtime.publishNightResolved(() => nightDeaths);
  const sources: DeathSources = Object.fromEntries(
    nightDeaths.map((id) => [id, [...(retainedSources[id] ?? [])]]),
  );
  const deaths = [...nightDeaths];
  const deathPhases: Record<EntityId, Phase> = {};
  if (blast !== undefined) {
    for (const id of blast.deaths) {
      if (!deaths.includes(id)) deaths.push(id);
      sources[id] = [...new Set([...(sources[id] ?? []), ...(blast.sources[id] ?? [])])];
      deathPhases[id] = Phase.Day;
    }
  }
  return { sourceDamage, originalLives, retainedSources, nightDeaths, sources, deaths, deathPhases };
}

/** 回调只在经理原 DR 参数展开点建立；动物／双生配置在该点选择，动物名单政策在真实发布时再次晚读。 */
export function ordinaryNightDeathPublication(
  runtime: OrdinaryNightDeathRuntime,
  nightDeaths: EntityId[],
  retainedSources: DeathSources,
): {
  onInitialWaveCommitted?: (
    actualIds: readonly number[],
    actualSources: DeathSources | undefined,
    receipt: DeathCommitReceipt,
  ) => GameEvent;
} {
  return runtime.config.fragrantPairSeer || runtime.config.animalDream
    ? {
        onInitialWaveCommitted: (
          actualIds: readonly number[],
          actualSources: DeathSources | undefined,
          receipt: DeathCommitReceipt,
        ) => {
          const event = runtime.publishNightResolved(() =>
            runtime.config.animalDream
              ? nightDeaths.filter(
                  (id) =>
                    actualIds.includes(id) &&
                    (retainedSources[id] ?? []).some((c) =>
                      (actualSources?.[id] ?? []).includes(c),
                    ),
                )
              : nightDeaths,
          );
          // 先写真实公开事件，再关联原完整 actualIds；回执失败不撤销事件，也不改变动物／双生 pending 筛选。
          receipt.recordPublication(event, actualIds);
          return event;
        },
      }
    : {};
}
