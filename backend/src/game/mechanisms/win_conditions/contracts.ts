/**
 * 负责胜利条件规格的数据契约。结构包含条件 ID、可选检查点与原评估函数，输入为 World／检查点，输出为判定或 null。
 * 规格由注册表装配和持有，契约声明不存储另一份结果、不修改生命或决定阶段推进。
 */
import type { VictoryCheckpoint } from "@ai-werewolf-arena/game-contract";
/** 文件说明：胜利条件规格契约。 */
import { WinDecision, WinCondition } from "../../../domain/model";
import { World } from "../../../domain/world";

/** 单个胜利条件规格定义。 */
export interface WinConditionSpec {
  id: WinCondition;
  checkpoints?: readonly VictoryCheckpoint[];
  evaluate: (world: World, checkpoint?: VictoryCheckpoint) => WinDecision | null;
}
