/**
 * 负责胜利条件的有序委托与覆盖结果优先选择。输入为原 World、只读条件 ID、检查点及覆盖数据；输出为首个原判定或 null。
 * 本入口不改变参数数组或封存结果，真实检查点执行与终局仍由 PhaseManager 持有。
 */
import type { VictoryCheckpoint } from "@ai-werewolf-arena/game-contract";
import { WinDecision, WinCondition } from "../model";
import { World } from "../world";

/**
 * 胜负判定注册中心抽象：由机制层实现并在装配期注入。
 */
export interface WinConditionEvaluator {
  evaluate(
    world: World,
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
    world: World,
    condition: WinCondition,
    checkpoint?: VictoryCheckpoint,
  ): WinDecision | null {
    return this.winRegistry.evaluate(world, condition, checkpoint);
  }

  /**
   * 按给定顺序评估多个胜负模式，命中即返回。
   */
  evaluateMany(
    world: World,
    conditions: readonly WinCondition[],
    checkpoint?: VictoryCheckpoint,
    overrides: Partial<Record<WinCondition, WinDecision>> = {},
  ): WinDecision | null {
    for (const condition of conditions) {
      const result = overrides[condition] ?? this.evaluate(world, condition, checkpoint);
      if (result) {
        return result;
      }
    }
    return null;
  }
}
