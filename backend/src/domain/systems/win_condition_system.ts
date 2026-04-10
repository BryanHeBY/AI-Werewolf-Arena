import { GameResult, WinCondition } from "../model";
import { World } from "../world";
import {
  getDefaultWinConditionRegistry,
  WinConditionRegistry,
} from "../../mechanisms";

/**
 * 兼容层：
 * 历史上由该系统直接硬编码胜负规则，现改为委托机制注册中心。
 */
export class WinConditionSystem {
  private readonly registry: WinConditionRegistry;

  constructor(registry: WinConditionRegistry = getDefaultWinConditionRegistry()) {
    this.registry = registry;
  }

  evaluate(world: World, condition: WinCondition): GameResult | null {
    return this.registry.evaluate(world, condition);
  }
}
