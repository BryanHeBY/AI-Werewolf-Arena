import { GameResult, WinCondition } from "../model";
import { WinConditionSystem } from "../systems/win_condition_system";
import { World } from "../world";

/**
 * 胜负条件注册表：当前作为 WinConditionSystem 的轻量封装入口。
 * 后续若支持更多胜负插件，可在这里扩展动态注册逻辑。
 */
export class ConditionRegistry {
  private readonly winSystem: WinConditionSystem;

  constructor(winSystem: WinConditionSystem) {
    this.winSystem = winSystem;
  }

  /**
   * 按指定胜负模式执行胜负判定。
   */
  evaluate(world: World, condition: WinCondition): GameResult | null {
    return this.winSystem.evaluate(world, condition);
  }
}
