import { GameResult, WinCondition } from "../model";
import { World } from "../world";

/**
 * 胜负判定注册中心抽象：由机制层实现并在装配期注入。
 */
export interface WinConditionEvaluator {
  evaluate(world: World, condition: WinCondition): GameResult | null;
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
  evaluate(world: World, condition: WinCondition): GameResult | null {
    return this.winRegistry.evaluate(world, condition);
  }

  /**
   * 按给定顺序评估多个胜负模式，命中即返回。
   */
  evaluateMany(world: World, conditions: WinCondition[]): GameResult | null {
    for (const condition of conditions) {
      const result = this.evaluate(world, condition);
      if (result) {
        return result;
      }
    }
    return null;
  }
}
