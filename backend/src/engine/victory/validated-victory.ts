/**
 * 负责终局候选的完整结构、胜利成员和决定时点校验，输入为候选与当前世界／日期的晚读端口。
 * 输出为已核对的 winner、outcome 和 decidedAt 数据；不选择胜负规则、不写入终局或发布事件。
 * 成员按独立 Victory 归属重建，不由角色或实际阵营猜测；单人、关系及附加胜利保原顺序。
 * 结构拒绝、赢家／理由拒绝、成员拒绝、时点拒绝依次发生；调用方仍拥有必要死亡链及唯一封盘。
 */
import type {
  Camp,
  GameOutcome,
  Phase,
  VictoryCheckpoint,
  VictoryPoint,
  WinDecision,
} from "@ai-werewolf-arena/game-contract";
import type { World } from "../../domain/world";
import { readGameOutcome, readVictoryPoint } from "@ai-werewolf-arena/replay-contract";
import { victoryDecision } from "./results";

/** 校验结果尚未封盘；它不携带资源／行动权限，也不替代引擎的当前终态检查。 */
export interface ValidatedVictoryDecision {
  readonly winner: Camp | null;
  readonly outcome: GameOutcome;
  readonly decidedAt: VictoryPoint;
}

export function validateVictoryDecision(
  decision: WinDecision,
  checkpoint: VictoryCheckpoint,
  phase: Phase,
  world: () => World,
  day: () => number,
): ValidatedVictoryDecision {
  const outcome = readGameOutcome(decision.outcome, world().entityIds());
  const winner =
    outcome.kind === "victory" && outcome.primary.kind === "faction"
      ? (outcome.primary.faction as Camp)
      : null;
  if (
    winner !== decision.winner ||
    typeof decision.reason !== "string" ||
    decision.reason.length === 0
  )
    throw new Error("game_result_invalid");
  if (outcome.kind === "victory") {
    const targets = [outcome.primary, ...outcome.additional].map(
      ({ winningPlayerIds: _ids, ...target }) => target,
    );
    const expected = victoryDecision(
      world(),
      targets[0],
      decision.reason,
      targets.slice(1),
    ).outcome;
    if (JSON.stringify(expected) !== JSON.stringify(outcome))
      throw new Error("game_result_membership_invalid");
  }
  // 日期只在所有成员检查通过后读取，校验失败不提前观察或改写阶段状态。
  const decidedAt = readVictoryPoint({ day: day(), phase, checkpoint });
  return { winner, outcome, decidedAt };
}
