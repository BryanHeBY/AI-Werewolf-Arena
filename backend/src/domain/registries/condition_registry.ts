import { GameResult, WinCondition } from "../model";
import { WinConditionSystem } from "../systems/win_condition_system";
import { World } from "../world";

export class ConditionRegistry {
  private readonly winSystem: WinConditionSystem;

  constructor(winSystem: WinConditionSystem) {
    this.winSystem = winSystem;
  }

  evaluate(world: World, condition: WinCondition): GameResult | null {
    return this.winSystem.evaluate(world, condition);
  }
}
