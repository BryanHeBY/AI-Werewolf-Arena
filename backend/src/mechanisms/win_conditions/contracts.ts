import { GameResult, WinCondition } from "../../domain/model";
import { World } from "../../domain/world";

export interface WinConditionSpec {
  id: WinCondition;
  description: string;
  evaluate: (world: World) => GameResult | null;
}
