/**
 * 负责按遗言政策判定资格，并为已死亡玩家发表遗言授予事实。
 * 输入为死亡阶段、日期、原死因及可选初始波上下文；记录入口另接收 World 与待写事件数组。
 * 输出为资格布尔值和 last_words_granted 事件；实际生命仍在写入前检查，规则未知则拒绝。
 * 此机制不执行玩家发言、更新死亡波或判胜，发言与阶段推进归原调用流程。
 */
/** 文件说明：遗言规则与事件写入机制。 */
import type { LastWordsPolicy } from "../../../domain/board";
import { AliveComponent } from "../../../domain/components/alive";
import { COMPONENT } from "../../../domain/components/names";
import {
  EntityId,
  GameEvent,
  Phase,
  DeathCause,
  type DeathSources,
} from "../../../domain/model";
import { World } from "../../../domain/world";
import { FRAGRANT_PAIR_POLICY } from "@ai-werewolf-arena/game-contract/facts/fragrant-pair-seer";
export interface LastWordsGrantContext {
  policy: typeof FRAGRANT_PAIR_POLICY;
  initialWave: boolean;
}

/** 遗言机制：判定是否可遗言并写入遗言授权事件。 */
export class LastWordsMechanism {
  /** 这里只判来源阶段、日期与死因；基础政策是否初始波由调用方筛选，不凭资格布尔值直接开放发言。 */
  shouldGrantLastWords(
    deathPhase: Phase,
    day: number,
    sources: readonly DeathCause[],
    policy: LastWordsPolicy = "awa_initial_wave_v1",
    context?: LastWordsGrantContext,
  ): boolean {
    // 具名政策要求全部原因已知，再允许白天／投票及首夜夜死；不借当前执行阶段猜测死亡来源。
    if (policy === "netease_2017_day_and_first_night_v1") {
      if (!sources.length || sources.some((source) => !Object.values(DeathCause).includes(source)))
        return false;
      return (
        deathPhase === Phase.Day ||
        deathPhase === Phase.Voting ||
        (deathPhase === Phase.Night && day === 1)
      );
    }
    if (policy !== "awa_initial_wave_v1") return false;
    if (
      sources.length === 0 ||
      sources.includes(DeathCause.SelfDestruct) ||
      sources.includes(DeathCause.WhiteWolfBlast)
    )
      return false;
    if (deathPhase === Phase.Day && sources.every((source) => source === DeathCause.DuelFailure))
      return true;
    return (
      (deathPhase === Phase.Night &&
        day === 1 &&
        sources.some(
          (source) =>
            source === DeathCause.WolfKill ||
            (source === DeathCause.FragrantLink &&
              context?.policy === FRAGRANT_PAIR_POLICY &&
              context.initialWave) ||
            source === DeathCause.AwakenedHiddenKnife ||
            source === DeathCause.Poison ||
            source === DeathCause.Dream ||
            source === DeathCause.FoxInspection ||
            source === DeathCause.MerchantBacklash ||
            source === DeathCause.BlackMarketBacklash,
        )) ||
      (deathPhase === Phase.Voting && sources.includes(DeathCause.Exile))
    );
  }

  /** 逐人再次核死因政策与实际死亡，只写授予事实；等待玩家、打开生命许可和记录发言归结算器。 */
  recordLastWordsGranted(
    world: World,
    deadIds: EntityId[],
    deathPhase: Phase,
    lastWordsPhase: Phase,
    day: number,
    events: GameEvent[],
    sources: DeathSources,
    deathPhases: Readonly<Record<EntityId, Phase>> = {},
    policy: LastWordsPolicy = "awa_initial_wave_v1",
    context?: LastWordsGrantContext,
  ): void {
    for (const deadId of deadIds) {
      if (
        !this.shouldGrantLastWords(
          deathPhases[deadId] ?? deathPhase,
          day,
          sources[deadId] ?? [],
          policy,
          context,
        )
      ) {
        continue;
      }
      const alive = world.getComponent(deadId, COMPONENT.Alive);
      if (!alive || alive.alive) {
        continue;
      }
      events.push({
        timestamp: Date.now(),
        type: "last_words_granted",
        payload: {
          playerId: deadId,
          phase: lastWordsPhase,
          day,
        },
      });
    }
  }
}

let defaultMechanism: LastWordsMechanism | null = null;

/** 获取默认遗言机制实例。 */
export function getDefaultLastWordsMechanism(): LastWordsMechanism {
  if (!defaultMechanism) {
    defaultMechanism = new LastWordsMechanism();
  }
  return defaultMechanism;
}
