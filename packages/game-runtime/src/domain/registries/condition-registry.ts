/**
 * 负责胜利条件的有序委托与覆盖结果优先选择。输入为实际判胜查询、只读条件 ID、检查点及覆盖数据；输出为首个原判定或 null。
 * 本入口不改变参数数组或封存结果，真实检查点执行与终局仍由 PhaseManager 持有。
 */
import type { VictoryCheckpoint, VictoryTarget } from "@ai-werewolf-arena/game-contract";
import { type Camp, type EntityId, type Role, WinDecision, WinCondition } from "../model";

/** 真实存活阵营统计，不以胜利成员、查验标签或历史知识代替当前 Camp。 */
export interface AliveVictoryCounts {
  readonly wolves: number;
  readonly gods: number;
  readonly villagers: number;
  readonly good: number;
}

/**
 * 判胜专用查询面；方法按调用时点读取，所有返回值都是编号、标量或判定数据。
 * decision 只构造候选，阶段经理仍负责成员复核和唯一封盘。
 */
export interface VictoryQueries {
  entityIds(): readonly EntityId[];
  aliveIds(): readonly EntityId[];
  role(id: EntityId): Role | undefined;
  camp(id: EntityId): Camp | undefined;
  eliminationCounts(): AliveVictoryCounts;
  cupidCityDecision(): { decision: WinDecision | null } | null;
  weddingFactionResult(): { faction: Camp | null; winningPlayerIds: number[] } | null;
  decision(
    primary: VictoryTarget,
    reason: string,
    additional?: readonly VictoryTarget[],
  ): WinDecision;
}

/**
 * 胜负判定注册中心抽象：由机制层实现并在装配期注入。
 * 可替换 evaluate 只接专用查询，不接原 World 或可写组件；领域提交和唯一封盘仍归引擎。
 */
export interface WinConditionEvaluator {
  evaluate(
    queries: VictoryQueries,
    condition: WinCondition,
    checkpoint?: VictoryCheckpoint,
  ): WinDecision | null;
}

/**
 * 胜负条件入口：委托机制层 WinConditionRegistry。
 */
export class ConditionRegistry {
  private readonly winRegistry: WinConditionEvaluator;

  constructor(winRegistry: WinConditionEvaluator) {
    this.winRegistry = winRegistry;
  }

  /**
   * 按指定胜负模式执行胜负判定。
   */
  evaluate(
    queries: VictoryQueries,
    condition: WinCondition,
    checkpoint?: VictoryCheckpoint,
  ): WinDecision | null {
    return this.winRegistry.evaluate(queries, condition, checkpoint);
  }

  /**
   * 按给定顺序评估多个胜负模式，命中即返回。
   */
  evaluateMany(
    queries: VictoryQueries,
    conditions: readonly WinCondition[],
    checkpoint?: VictoryCheckpoint,
    overrides: Partial<Record<WinCondition, WinDecision>> = {},
  ): WinDecision | null {
    for (const condition of conditions) {
      const result = overrides[condition] ?? this.evaluate(queries, condition, checkpoint);
      if (result) {
        return result;
      }
    }
    return null;
  }
}
