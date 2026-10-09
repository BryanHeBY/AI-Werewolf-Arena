import type { VictoryCheckpoint } from "@ai-werewolf-arena/game-catalog";
/** 文件说明：胜利条件规格契约。 */
import { WinDecision, WinCondition } from "../../../core/domain/model";
import { World } from "../../../core/domain/world";

/** 单个胜利条件规格定义。 */
export interface WinConditionSpec {
  id: WinCondition;
  checkpoints?: readonly VictoryCheckpoint[];
  evaluate: (world: World, checkpoint?: VictoryCheckpoint) => WinDecision | null;
}
