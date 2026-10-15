/**
 * 负责维护引擎、归档与展示共享的语言中立胜利数据。输入为阵营及裁决检查点标识，输出归属、胜利主张与结局结构。
 * 阵营／个人／关系由 kind 区分，真实身份、死亡链时点与赢家选择仍由引擎拥有；格式声明不执行胜利政策或替代当前 Camp。
 */
export const FACTION_IDS = ["good", "wolf", "third_party"] as const;
export type FactionId = (typeof FACTION_IDS)[number];
export const VICTORY_CHECKPOINTS = [
  "night_settled",
  "day_interrupted",
  "exile_settled",
  "max_days_reached",
] as const;
export type VictoryCheckpoint = (typeof VICTORY_CHECKPOINTS)[number];
export interface VictoryPoint {
  day: number;
  phase: "night" | "day" | "voting";
  checkpoint: VictoryCheckpoint;
}
// 归属描述胜利目标，目标补充具体主体，主张再附上赢家名单；三者都不持有运行授权。
export type VictoryAffiliation =
  | { kind: "faction"; faction: FactionId }
  | { kind: "individual"; goalId: string }
  | { kind: "relationship"; groupId: string };
export type VictoryTarget =
  | { kind: "faction"; faction: FactionId }
  | { kind: "individual"; goalId: string; playerId: number }
  | { kind: "relationship"; groupId: string };
export type VictoryClaim = VictoryTarget & { winningPlayerIds: number[] };
// no_winner 与 victory 分支独立；主胜利和附加胜利保留原分层，不从兼容 winner 标签反推。
export type GameOutcome =
  | {
      kind: "victory";
      primary: VictoryClaim;
      additional: VictoryClaim[];
      winningPlayerIds: number[];
    }
  | { kind: "no_winner" };
export interface SealedVictoryResult {
  winner: FactionId | null;
  reason: string;
  outcome: GameOutcome;
  decidedAt: VictoryPoint;
}
