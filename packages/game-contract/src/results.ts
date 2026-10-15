/**
 * 负责归档与协议消费者共享的结果和阶段摘要数据。输入为契约身份、查验事实与胜利结构，输出保留原 Camp／Phase 枚举类型、null 与可选字段的声明。
 * 这些摘要记录已产生的结果，不选择赢家、结算死亡或授予行动；事件事实与实时运行权限不由类型别名推导。
 */
import type { Camp, EntityId, Phase } from "./identity";
import type { InspectionResult } from "./inspection";
import type { GameOutcome, VictoryPoint } from "./outcomes";

export interface GameResult {
  winner: Camp | null;
  reason: string;
  outcome: GameOutcome;
  decidedAt: VictoryPoint;
}
export type WinDecision = Omit<GameResult, "decidedAt">;

export interface SeerCheckResult {
  seerId: EntityId;
  targetId: EntityId;
  isWerewolf: boolean;
  result: Extract<InspectionResult, { kind: "camp" }>;
}

export interface NightSummary {
  wolfTarget: EntityId | null;
  deaths: EntityId[];
  seerChecks: SeerCheckResult[];
  interruptedBySelfDestruct: boolean;
}

export interface DaySummary {
  speeches: Array<{ actorId: EntityId; text: string }>;
  selfDestructBy: EntityId | null;
}

export interface VotingSummary {
  /** 实际放逐目标；target 仍记录公开票选目标。缺省与显式 null 保持不同数据状态。 */
  effectiveTarget?: EntityId | null;
  tally: Record<number, number>;
  target: EntityId | null;
  removed: EntityId[];
}

// result 为 null 表示此快照尚无结果；day／phase／gameOver 仍是记录值，不是实时 World 句柄。
export interface RuntimeSnapshot {
  day: number;
  phase: Phase;
  gameOver: boolean;
  result: GameResult | null;
}
