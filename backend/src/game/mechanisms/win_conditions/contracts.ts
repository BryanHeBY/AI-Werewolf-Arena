/** 文件说明：胜利条件规格契约。 */
import { GameResult, WinCondition } from "../../../domain/model";
import { World } from "../../../domain/world";

/** 单个胜利条件规格定义。 */
export interface WinConditionSpec {
  id: WinCondition;
  description: string;
  evaluate: (world: World) => GameResult | null;
}
