/**
 * 构造录制测试的字面 GameResult；输入只有 winner 和 reason。null 胜方得到 no_winner，非 null 得到含玩家 1 的阵营胜利；判定日固定为 1，阶段和 checkpoint 随 null 分支选择。此 helper 只构造预期数据，不读取 World、运行结算或生成板子／库存。
 */
import { Camp } from "../../../../src/domain/identity";
import { Phase } from "../../../../src/domain/identity";
import type { GameResult } from "../../../../src/domain/results";

export function fixtureResult(winner: Camp | null, reason: string): GameResult {
  return {
    winner,
    reason,
    outcome:
      winner === null
        ? { kind: "no_winner" }
        : {
            kind: "victory",
            primary: { kind: "faction", faction: winner, winningPlayerIds: [1] },
            additional: [],
            winningPlayerIds: [1],
          },
    decidedAt: {
      day: 1,
      phase: winner === null ? Phase.Night : Phase.Voting,
      checkpoint: winner === null ? "max_days_reached" : "exile_settled",
    },
  };
}
