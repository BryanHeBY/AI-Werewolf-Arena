import { GameResult, WinCondition } from "../model";
import { World } from "../world";
import {
  getDefaultWinConditionRegistry,
  WinConditionRegistry,
} from "../../mechanisms";

/**
 * 胜负条件入口：委托机制层 WinConditionRegistry。
 */
export class ConditionRegistry {
  private readonly winRegistry: WinConditionRegistry;

  constructor(winRegistry: WinConditionRegistry = getDefaultWinConditionRegistry()) {
    this.winRegistry = winRegistry;
  }

  /**
   * 按指定胜负模式执行胜负判定。
   */
  evaluate(world: World, condition: WinCondition): GameResult | null {
    return this.winRegistry.evaluate(world, condition);
  }
}
