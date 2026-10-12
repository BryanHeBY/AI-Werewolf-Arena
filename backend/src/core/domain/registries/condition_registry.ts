/**
 * Owns ordered delegation of victory conditions and override-first selection.
 * Inputs are original World, readonly condition IDs and checkpoint/override data;
 * output is the first original decision or null. This boundary neither changes
 * parameter arrays nor seals results; PhaseManager retains executed checkpoints.
 */
import type { VictoryCheckpoint } from "@ai-werewolf-arena/game-catalog";
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
