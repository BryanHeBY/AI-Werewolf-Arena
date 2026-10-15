/**
 * 负责为核心层结果与阶段摘要消费者保留现有类型入口。输入为 game-contract 唯一数据定义，输出同源公共类型别名。
 * 这里不另建结果格式、不计算胜负、不渲染文案或写入状态；这些历史入口仍是兼容引用，不能当成新增裁决事实。
 */
export type {
  GameResult,
  WinDecision,
  SeerCheckResult,
  NightSummary,
  DaySummary,
  VotingSummary,
  RuntimeSnapshot,
} from "@ai-werewolf-arena/game-contract";
