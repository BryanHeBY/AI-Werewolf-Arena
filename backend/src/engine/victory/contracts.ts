/**
 * 负责胜利条件规格与评估查询契约。扩展只取得当前数据与结果构造能力，不能写世界。
 * 规格由注册表装配和持有，契约声明不存储另一份结果、不修改生命或决定阶段推进。
 */
import type { VictoryCheckpoint } from "@ai-werewolf-arena/game-contract";
/** 文件说明：胜利条件规格契约。 */
import { WinDecision, WinCondition } from "../../domain/model";
import type { VictoryQueries } from "../../domain/registries/condition-registry";
export type {
  AliveVictoryCounts,
  VictoryQueries,
} from "../../domain/registries/condition-registry";

/** 单个胜利条件规格定义。 */
export interface WinConditionSpec {
  id: WinCondition;
  checkpoints?: readonly VictoryCheckpoint[];
  evaluate: (queries: VictoryQueries, checkpoint?: VictoryCheckpoint) => WinDecision | null;
}
