/**
 * 负责胜利条件规格索引和具名评估委托。输入为原规格、实际判胜查询、条件与检查点，输出原判定或 null，未知条件保原错误。
 * 索引唯一持有规格 Map，允许检查点才调用原 evaluate；本注册表不推进阶段或封盘。
 */
import type { VictoryCheckpoint } from "@ai-werewolf-arena/game-contract";
/** 文件说明：管理胜利条件规格与评估入口。 */
import { WinDecision, WinCondition } from "../../domain/model";
import { DEFAULT_WIN_CONDITION_SPECS } from "../../rulesets/victory/default-specs";
import { WinConditionSpec, type VictoryQueries } from "./contracts";

/**
 * 每个实际规格独占一份可写查询表，保原规格覆盖本地方法但不污染后续规格的隔离。
 * 不展开 source 或预读任何方法；默认 source 仍由原 bindVictoryQueries 私有绑定同一 World。
 * 新 lower API 传入的外来自造 source，其方法只在使用时查找并保 source receiver／实参数量；
 * 这层晚委托不承诺任意 Proxy、函数身份／length 或 getter 相对实参的旧观察完全相同。
 */
function specQueries(source: VictoryQueries): VictoryQueries {
  return {
    entityIds: (...args) => source.entityIds(...args),
    aliveIds: (...args) => source.aliveIds(...args),
    role: (...args) => source.role(...args),
    camp: (...args) => source.camp(...args),
    eliminationCounts: (...args) => source.eliminationCounts(...args),
    cupidCityDecision: (...args) => source.cupidCityDecision(...args),
    weddingFactionResult: (...args) => source.weddingFactionResult(...args),
    decision: (...args) => source.decision(...args),
  };
}

/** 胜利条件注册表。 */
export class WinConditionRegistry {
  private readonly specById = new Map<WinCondition, WinConditionSpec>();

  constructor(specs: WinConditionSpec[] = DEFAULT_WIN_CONDITION_SPECS) {
    for (const spec of specs) {
      this.specById.set(spec.id, spec);
    }
  }

  get(condition: WinCondition): WinConditionSpec | undefined {
    return this.specById.get(condition);
  }

  evaluate(
    queries: VictoryQueries,
    condition: WinCondition,
    checkpoint?: VictoryCheckpoint,
  ): WinDecision | null {
    const spec = this.specById.get(condition);
    if (!spec) {
      throw new Error(`Unknown win condition: ${condition}`);
    }
    if (spec.checkpoints && (checkpoint === undefined || !spec.checkpoints.includes(checkpoint)))
      return null;
    // 可信调用方在原World参数位置绑定查询；先核原条件和检查点，再按原receiver调用规格。
    // 本入口不反向取得World，也不以查询对象或候选返回值授予封盘权。
    return spec.evaluate(specQueries(queries), checkpoint);
  }

  all(): WinConditionSpec[] {
    return Array.from(this.specById.values());
  }
}

let defaultRegistry: WinConditionRegistry | null = null;

/** 获取默认胜利条件注册表实例。 */
export function getDefaultWinConditionRegistry(): WinConditionRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new WinConditionRegistry();
  }
  return defaultRegistry;
}
