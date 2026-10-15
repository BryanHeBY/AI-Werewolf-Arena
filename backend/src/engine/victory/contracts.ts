/**
 * 负责胜利条件规格与评估查询契约。扩展只取得当前数据与结果构造能力，不能写世界。
 * 规格由注册表装配和持有，契约声明不存储另一份结果、不修改生命或决定阶段推进。
 */
import type { VictoryCheckpoint } from "@ai-werewolf-arena/game-contract";
/** 文件说明：胜利条件规格契约。 */
import type { VictoryTarget } from "@ai-werewolf-arena/game-contract";
import { Camp, type EntityId, type Role, WinDecision, WinCondition } from "../../domain/model";

/** 真实存活阵营统计，不以胜利成员、查验标签或历史知识代替当前 Camp。 */
export interface AliveVictoryCounts {
  readonly wolves: number;
  readonly gods: number;
  readonly villagers: number;
  readonly good: number;
}

/**
 * 判胜专用查询面；方法按调用时点读取，所有返回值都是编号、标量或判定数据。
 * decision 只构造候选，阶段经理仍负责成员复核和唯一封盘。
 */
export interface VictoryQueries {
  entityIds(): readonly EntityId[];
  aliveIds(): readonly EntityId[];
  role(id: EntityId): Role | undefined;
  camp(id: EntityId): Camp | undefined;
  eliminationCounts(): AliveVictoryCounts;
  cupidCityDecision(): { decision: WinDecision | null } | null;
  weddingFactionResult(): { faction: Camp | null; winningPlayerIds: number[] } | null;
  decision(
    primary: VictoryTarget,
    reason: string,
    additional?: readonly VictoryTarget[],
  ): WinDecision;
}

/** 单个胜利条件规格定义。 */
export interface WinConditionSpec {
  id: WinCondition;
  checkpoints?: readonly VictoryCheckpoint[];
  evaluate: (queries: VictoryQueries, checkpoint?: VictoryCheckpoint) => WinDecision | null;
}
